import { spawn } from 'child_process';

import type { ClientPlatform, ServiceNetwork } from '../run/types/target';

import {
  devicesRequired,
  type ParallelPass,
  type ParallelTier,
  passGrep,
} from '../run/constants/parallelism';
import { ALLOWED_NETWORKS } from '../run/test/utils/network_target';

/**
 * The whole of a tiered parallel run, for both platforms.
 *
 * `run_ios_parallel.ts` and `run_android_parallel.ts` differ in exactly one thing: what they have to
 * arrange before a run. The iOS one creates and deletes a simulator pool; the Android one can only
 * check that an already-booted one is there, because Appium will not boot an emulator. That is the
 * `prepareDevices` hook, and everything else — argument parsing, validation, the child environment,
 * the pass loop, cleanup and the exit status — is `runParallelSuite` here.
 *
 * Nothing in this module knows which platform it is serving; the caller passes the tier table, the
 * noun for its devices and the env var its worker count lives in.
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

/**
 * Accepts both `--flag value` and `--flag=value`; the boolean says whether `next` was consumed.
 *
 * A missing value is refused rather than read as empty: `--network` and `--grep` would otherwise
 * silently fall back to their defaults, and an unnoticed `--network` default provisions the pool and
 * runs the suite against the wrong network.
 */
function readValue(current: string, next: string | undefined): [string, boolean] {
  const eq = current.indexOf('=');
  const [value, consumedNext] = eq !== -1 ? [current.slice(eq + 1), false] : [next ?? '', true];

  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${eq === -1 ? current : current.slice(0, eq)}.`);
    process.exit(1);
  }

  return [value, consumedNext];
}

function parseParallelArgs<T extends ParallelArgsBase>({
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
 * What one platform's runner has to say about itself. Everything else is shared.
 */
export type ParallelSuite<T extends ParallelArgsBase> = {
  platform: ClientPlatform & ('android' | 'ios');
  /** Singular, for the messages: "simulator" / "emulator". */
  deviceNoun: string;
  /** The platform filter a run falls back to when no --grep is given. */
  defaultGrep: string;
  workersEnvVar: 'PLAYWRIGHT_WORKERS_COUNT_ANDROID' | 'PLAYWRIGHT_WORKERS_COUNT_IOS';
  maxDevices: number;
  tiers: Record<string, ParallelTier>;
  tierNames: readonly string[];
  tiersPreamble: string;
  defaults: T;
  /** Flags only this platform takes, e.g. --keep and --runtime on iOS. */
  extraFlags?: ExtraFlags<T>;
  /**
   * The one thing the platforms do not share: iOS creates the pool it just sized, Android can only
   * check that one is attached. Returning env merges it into the child's (iOS passes its new UDIDs
   * that way); returning a cleanup runs it once, whether the run finished or threw.
   */
  prepareDevices: (args: T, deviceCount: number) => DevicePrep | void;
};

export type DevicePrep = { env?: NodeJS.ProcessEnv; cleanup?: () => void };

/**
 * Both suites live in the `mobile` project. Passing it keeps a desktop or cross-platform title that
 * happens to contain `@ios`/`@android` out of the run — no title does today, so this changes nothing
 * yet; it is what stops one appearing from silently widening a mobile run.
 */
const MOBILE_PROJECT_ARGS = ['--project', 'mobile'];

/**
 * How many devices the run will draw, refusing anything the pool cannot serve.
 *
 * Checked before either runner touches a device: on iOS an invalid `--network` would otherwise create
 * the whole simulator pool before failing downstream, and on Android an over-subscribed run would
 * reach the tests and fail each one individually.
 */
function validateParallelArgs<T extends ParallelArgsBase>(
  suite: ParallelSuite<T>,
  args: T
): number {
  const { tiers, maxDevices, deviceNoun } = suite;

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

function printTiers<T extends ParallelArgsBase>({
  tiers,
  tierNames,
  deviceNoun,
  tiersPreamble,
}: ParallelSuite<T>): void {
  console.log(`\n${tiersPreamble}\n`);
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
function runPlaywright(playwrightArgs: string[], env: NodeJS.ProcessEnv): Promise<number> {
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

type PassResult = { pass: ParallelPass; code: number };

function printTierSummary(name: string, deviceNoun: string, results: PassResult[]): void {
  console.log(`\n=== tier "${name}" summary ===`);
  for (const { pass, code } of results) {
    const status = code === 0 ? 'pass' : `FAILED (exit ${code})`;
    console.log(
      `  @${pass.devices}-devices x${pass.workers} worker(s) (${deviceNoun}s): ${status}`
    );
  }
  console.log('');
}

/**
 * One Playwright invocation per device class, in sequence, resolving with the run's exit status.
 *
 * A failing pass does NOT stop the ones after it: a regression run is worth completing so you see
 * every device class rather than everything up to the first breakage.
 */
async function runTier<T extends ParallelArgsBase>(
  suite: ParallelSuite<T>,
  args: T,
  tierName: string,
  baseEnv: NodeJS.ProcessEnv
): Promise<number> {
  const { platform, deviceNoun, defaultGrep, workersEnvVar } = suite;
  const results: PassResult[] = [];

  for (const pass of suite.tiers[tierName].passes) {
    // The pass owns the platform and device-count filter; a caller-supplied --grep is ANDed on top as
    // a further lookahead rather than replacing it, so `--grep '@high-risk'` narrows each pass instead
    // of selecting the wrong device class.
    const passFilter = passGrep(pass, platform);
    const combined = args.grep === defaultGrep ? passFilter : `${passFilter}(?=.*${args.grep})`;

    console.log(
      `\n=== tier "${tierName}": @${pass.devices}-devices, ${pass.workers} worker(s), ` +
        `${pass.devices * pass.workers} ${deviceNoun}(s) ===`
    );

    const code = await runPlaywright(
      [
        'playwright',
        'test',
        ...MOBILE_PROJECT_ARGS,
        '--grep',
        combined,
        // An empty pass is not a failure: an extra --grep can legitimately clear one device class
        // while the others still have work to do.
        '--pass-with-no-tests',
        ...args.passthrough,
      ],
      {
        ...baseEnv,
        DEVICES_PER_TEST_COUNT: String(pass.devices),
        [workersEnvVar]: String(pass.workers),
      }
    );

    results.push({ pass, code });
  }

  printTierSummary(tierName, deviceNoun, results);

  return results.some(r => r.code !== 0) ? 1 : 0;
}

/** Parses, validates, provisions, runs, cleans up, and exits with the run's status. */
export async function runParallelSuite<T extends ParallelArgsBase>(
  suite: ParallelSuite<T>,
  argv: string[]
): Promise<never> {
  const args = parseParallelArgs<T>({
    argv,
    defaults: suite.defaults,
    tierNames: suite.tierNames,
    extra: suite.extraFlags,
  });

  if (args.listTiers) {
    printTiers(suite);
    process.exit(0);
  }

  const deviceCount = validateParallelArgs(suite, args);
  const prep = suite.prepareDevices(args, deviceCount) ?? {};

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...prep.env,
    PLATFORM: suite.platform,
    [suite.workersEnvVar]: String(args.workers),
    DEVICES_PER_TEST_COUNT: String(args.devicesPerWorker),
  };
  // Silences the driver's per-command logging; a tiered run is long enough that the noise buries
  // the reporter's own output.
  childEnv._TESTING = childEnv._TESTING ?? '1';
  // Left unset otherwise, so .env's NETWORK_TARGET is respected. Devnet also needs DEVNET_SEED_URL
  // in .env — everything else about it is discovered (see run/test/utils/network_target.ts).
  if (args.network) {
    childEnv.NETWORK_TARGET = args.network;
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    prep.cleanup?.();
  };

  try {
    const code = args.tier
      ? await runTier(suite, args, args.tier, childEnv)
      : await runPlaywright(
          ['playwright', 'test', ...MOBILE_PROJECT_ARGS, '--grep', args.grep, ...args.passthrough],
          childEnv
        );
    cleanup();
    // Preserve the child's exit status so CI/other callers see the real result.
    process.exit(code);
  } catch (err) {
    console.error('Failed to start Playwright:', err);
    cleanup();
    process.exit(1);
  }
}
