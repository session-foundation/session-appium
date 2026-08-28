import { spawn } from 'child_process';

import type { ServiceNetwork } from '../run/types/target';

import {
  devicesRequired,
  type ParallelPass,
  type ParallelTier,
  passGrep,
} from '../run/constants/parallelism';
import { ALLOWED_NETWORKS } from '../run/test/utils/network_target';

/**
 * The parts of the parallel runners that are the same on both platforms.
 *
 * `run_ios_parallel.ts` and `run_android_parallel.ts` differ in what they have to arrange before a
 * run — the iOS one creates and deletes a simulator pool, the Android one can only check that an
 * already-booted one is there — but everything from argument parsing to the pass loop was the same
 * code twice. The split here is along that line: this module owns the shape of a tiered run, and each
 * runner owns its own devices.
 *
 * Nothing here knows which platform it is serving; the caller passes the tier table, the noun for its
 * devices and the env var its workers count lives in.
 */

/** Flags both runners accept. A platform's own flags extend this. */
export type ParallelArgsBase = {
  workers: number;
  devicesPerWorker: number;
  grep: string;
  tier?: string;
  listTiers: boolean;
  /** Set when the caller passed --workers/--devices-per-worker, so --tier can reject the combination. */
  explicitPools: boolean;
  network?: string;
  passthrough: string[];
};

/** Platform-only flags, declared rather than parsed by hand, so the shared loop can own the rest. */
export type ExtraFlags<T> = {
  /** `--keep` — present or absent, no value. */
  boolean?: Record<string, (args: T) => void>;
  /** `--runtime 26.1` and `--runtime=26.1` both reach the handler with just the value. */
  value?: Record<string, (args: T, value: string) => void>;
};

/** Accepts both `--flag value` and `--flag=value`; the boolean says whether `next` was consumed. */
function readValue(current: string, next: string | undefined): [string, boolean] {
  const eq = current.indexOf('=');
  if (eq !== -1) {
    return [current.slice(eq + 1), false];
  }
  return [next ?? '', true];
}

export function parseParallelArgs<T extends ParallelArgsBase>({
  argv,
  defaults,
  tierNames,
  extra,
}: {
  argv: string[];
  defaults: T;
  tierNames: readonly string[];
  extra?: ExtraFlags<T>;
}): T {
  const args = { ...defaults };

  // Everything after a lone `--` is forwarded verbatim to Playwright.
  const sepIndex = argv.indexOf('--');
  const ownArgs = sepIndex === -1 ? argv : argv.slice(0, sepIndex);
  if (sepIndex !== -1) {
    args.passthrough = argv.slice(sepIndex + 1);
  }

  for (let i = 0; i < ownArgs.length; i++) {
    const arg = ownArgs[i];
    const booleanHandler = extra?.boolean?.[arg];
    if (booleanHandler) {
      booleanHandler(args);
      continue;
    }

    const extraValueName = Object.keys(extra?.value ?? {}).find(name => arg.startsWith(name));
    if (extraValueName) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      extra?.value?.[extraValueName]?.(args, value);
      if (consumedNext) i++;
      continue;
    }

    if (arg === '--list-tiers') {
      args.listTiers = true;
    } else if (arg.startsWith('--tier')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      if (!tierNames.includes(value)) {
        console.error(`Invalid --tier "${value}". Use ${tierNames.join(' | ')}.`);
        process.exit(1);
      }
      args.tier = value;
      if (consumedNext) i++;
    } else if (arg.startsWith('--workers')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.workers = parseInt(value);
      args.explicitPools = true;
      if (consumedNext) i++;
    } else if (arg.startsWith('--devices-per-worker')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.devicesPerWorker = parseInt(value);
      args.explicitPools = true;
      if (consumedNext) i++;
    } else if (arg.startsWith('--grep')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.grep = value;
      if (consumedNext) i++;
    } else if (arg.startsWith('--network')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.network = value;
      if (consumedNext) i++;
    } else {
      console.error(`Unknown argument: "${arg}". Forward Playwright args after a "--" separator.`);
      process.exit(1);
    }
  }

  return args;
}

/**
 * How many devices the run will draw, refusing anything the pool cannot serve.
 *
 * Checked before either runner touches a device: on iOS an invalid `--network` would otherwise create
 * the whole simulator pool before failing downstream, and on Android an over-subscribed run would
 * reach the tests and fail each one individually.
 */
export function validateParallelArgs<T extends ParallelArgsBase>({
  args,
  tiers,
  maxDevices,
  deviceNoun,
}: {
  args: T;
  tiers: Record<string, ParallelTier>;
  maxDevices: number;
  deviceNoun: string;
}): number {
  if (args.network && !ALLOWED_NETWORKS.includes(args.network as ServiceNetwork)) {
    console.error(`Invalid --network "${args.network}". Use ${ALLOWED_NETWORKS.join(' | ')}.`);
    process.exit(1);
  }

  const refuse = (message: string): never => {
    console.error(message);
    process.exit(1);
  };

  if (args.tier) {
    if (args.explicitPools) {
      refuse(
        `--tier sets devices-per-worker and workers per pass, so it cannot be combined with ` +
          `--workers / --devices-per-worker. Drop one or the other.`
      );
    }
    const needed = devicesRequired(tiers[args.tier]);
    if (needed > maxDevices) {
      refuse(
        `Tier "${args.tier}" needs ${needed} ${deviceNoun}s, but the maximum is ${maxDevices}.`
      );
    }
    return needed;
  }

  if (isNaN(args.workers) || args.workers < 1) {
    refuse(`Invalid --workers value: ${args.workers}`);
  }
  if (isNaN(args.devicesPerWorker) || args.devicesPerWorker < 1) {
    refuse(`Invalid --devices-per-worker value: ${args.devicesPerWorker}`);
  }

  const total = args.workers * args.devicesPerWorker;
  if (total > maxDevices) {
    refuse(
      `Requested ${args.workers} workers x ${args.devicesPerWorker} devices-per-worker = ` +
        `${total} ${deviceNoun}s, but the maximum is ${maxDevices}. ` +
        `Lower --workers or --devices-per-worker.`
    );
  }

  return total;
}

export function printTiers({
  tiers,
  tierNames,
  deviceNoun,
  preamble,
}: {
  tiers: Record<string, ParallelTier>;
  tierNames: readonly string[];
  deviceNoun: string;
  preamble: string;
}): void {
  console.log(`\n${preamble}\n`);
  for (const name of tierNames) {
    const tier = tiers[name];
    console.log(`  ${name} — ${tier.summary}`);
    console.log(`    ${deviceNoun}s needed: ${devicesRequired(tier)}`);
    for (const pass of tier.passes) {
      console.log(
        `      @${pass.devices}-devices  x${pass.workers} worker(s)  ` +
          `(${pass.devices * pass.workers} ${deviceNoun}s)`
      );
    }
    console.log('');
  }
}

/** Runs one Playwright invocation to completion and resolves with its exit status. */
export function runPlaywright(playwrightArgs: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning: npx ${playwrightArgs.join(' ')}\n`);
    const child = spawn('npx', playwrightArgs, { stdio: 'inherit', env });

    // Attached per invocation and detached on exit. A tiered run spawns one child per pass, so
    // leaving these registered would leak listeners and signal already-dead children.
    const forward = (signal: NodeJS.Signals) => () => child.kill(signal);
    const onInt = forward('SIGINT');
    const onTerm = forward('SIGTERM');
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    const detach = () => {
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
    };

    child.on('error', err => {
      detach();
      reject(err);
    });
    child.on('exit', (code, signal) => {
      detach();
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

export type PassResult = { pass: ParallelPass; code: number };

export function printTierSummary(name: string, results: PassResult[]): void {
  console.log(`\n=== tier "${name}" summary ===`);
  for (const { pass, code } of results) {
    const status = code === 0 ? 'pass' : `FAILED (exit ${code})`;
    console.log(`  @${pass.devices}-devices x${pass.workers} worker(s): ${status}`);
  }
  console.log('');
}

/**
 * One Playwright invocation per device class, in sequence.
 *
 * A failing pass does NOT stop the ones after it: a regression run is worth completing so you see
 * every device class rather than everything up to the first breakage. The caller decides the exit
 * status from the returned codes.
 */
export async function runTierPasses({
  tierName,
  tier,
  platform,
  grep,
  defaultGrep,
  workersEnvVar,
  deviceNoun,
  baseEnv,
  playwrightArgs,
  passthrough,
}: {
  tierName: string;
  tier: ParallelTier;
  platform: 'android' | 'ios';
  grep: string;
  defaultGrep: string;
  workersEnvVar: string;
  deviceNoun: string;
  baseEnv: NodeJS.ProcessEnv;
  /** Anything to put before `--grep`, e.g. `['--project', 'mobile']`. */
  playwrightArgs: string[];
  passthrough: string[];
}): Promise<PassResult[]> {
  const results: PassResult[] = [];

  for (const pass of tier.passes) {
    // The pass owns the platform and device-count filter; a caller-supplied --grep is ANDed on top as
    // a further lookahead rather than replacing it, so `--grep '@high-risk'` narrows each pass instead
    // of selecting the wrong device class.
    const passFilter = passGrep(pass, platform);
    const combined = grep === defaultGrep ? passFilter : `${passFilter}(?=.*${grep})`;

    console.log(
      `\n=== tier "${tierName}": @${pass.devices}-devices, ${pass.workers} worker(s), ` +
        `${pass.devices * pass.workers} ${deviceNoun}(s) ===`
    );

    const code = await runPlaywright(
      [
        'playwright',
        'test',
        ...playwrightArgs,
        '--grep',
        combined,
        // An empty pass is not a failure: an extra --grep can legitimately clear one device class
        // while the others still have work to do.
        '--pass-with-no-tests',
        ...passthrough,
      ],
      {
        ...baseEnv,
        DEVICES_PER_TEST_COUNT: String(pass.devices),
        [workersEnvVar]: String(pass.workers),
      }
    );

    results.push({ pass, code });
  }

  return results;
}
