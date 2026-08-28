import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';

import type { ServiceNetwork } from '../run/types/target';

import {
  ANDROID_PARALLEL_TIER_NAMES,
  ANDROID_PARALLEL_TIERS,
  type AndroidParallelTierName,
  devicesRequired,
  type ParallelPass,
  passGrep,
} from '../run/constants/parallelism';
import { getAdbFullPath } from '../run/test/utils/binaries';
import { ALLOWED_NETWORKS } from '../run/test/utils/network_target';
import { BASE_PORT, MAX_EMULATORS } from './android_config';

/**
 * Parallel Android test runner — the counterpart of `run_ios_parallel.ts`.
 *
 * Runs the Android suite across multiple Playwright workers, one invocation per device class.
 * `DEVICES_PER_TEST_COUNT` is a single global per invocation, so a single run has to size every
 * worker's pool for the largest spec: at `D=4` a `@1-devices` spec occupies a worker holding four
 * emulators and using one. Passes run in sequence, so the emulator draw is the largest pass rather
 * than the sum.
 *
 * **It provisions nothing, and that is the difference from the iOS runner.** Appium will not boot an
 * emulator, so the pool has to be up before the run starts (`pnpm create-emulators <n>`). This checks
 * the pool it needs is actually attached and refuses up front rather than letting each test fail with
 * `Invalid actual capability given` — nothing else validates `workers × devices` against the pool.
 *
 * Usage:
 *   pnpm test-android-parallel --tier standard        # tiered: one pass per device class
 *   pnpm test-android-parallel --list-tiers           # tiers and what they cost
 *   pnpm test-android-parallel --tier full --grep '@high-risk'   # narrows every pass
 *   pnpm test-android-parallel --workers 2 --devices-per-worker 2
 *   pnpm test-android-parallel --tier full -- --repeat-each 2    # after `--` goes to Playwright
 *
 * Notes:
 *   - The tier worker counts are UNMEASURED on Android; see `run/constants/parallelism.ts`. Treat a
 *     first run as a measurement.
 *   - RAM, not CPU, is the ceiling: an emulator costs 5-7 GB and an over-subscribed host fails with
 *     timeouts indistinguishable from product bugs.
 *   - A `--grep` alongside `--tier` is ANDed in as a further lookahead, so it narrows each pass
 *     rather than replacing the pass's own device-class filter.
 *   - A failing pass does not stop the rest; the exit status is non-zero if any pass failed.
 */

dotenv.config({ quiet: true });

const DEFAULT_GREP = '@android';

type ParsedArgs = {
  workers: number;
  devicesPerWorker: number;
  grep: string;
  tier?: AndroidParallelTierName;
  listTiers: boolean;
  /** Set when the caller passed --workers/--devices-per-worker, so --tier can reject the combination. */
  explicitPools: boolean;
  network?: string;
  passthrough: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    workers: 1,
    devicesPerWorker: 4,
    grep: DEFAULT_GREP,
    listTiers: false,
    explicitPools: false,
    passthrough: [],
  };

  // Everything after a lone `--` is forwarded verbatim to Playwright.
  const sepIndex = argv.indexOf('--');
  const ownArgs = sepIndex === -1 ? argv : argv.slice(0, sepIndex);
  if (sepIndex !== -1) {
    args.passthrough = argv.slice(sepIndex + 1);
  }

  // Accepts both `--flag value` and `--flag=value`.
  const readValue = (current: string, next: string | undefined): [string, boolean] => {
    const eq = current.indexOf('=');
    if (eq !== -1) {
      return [current.slice(eq + 1), false];
    }
    return [next ?? '', true];
  };

  for (let i = 0; i < ownArgs.length; i++) {
    const arg = ownArgs[i];
    if (arg === '--list-tiers') {
      args.listTiers = true;
    } else if (arg.startsWith('--tier')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      if (!ANDROID_PARALLEL_TIER_NAMES.includes(value as AndroidParallelTierName)) {
        console.error(`Invalid --tier "${value}". Use ${ANDROID_PARALLEL_TIER_NAMES.join(' | ')}.`);
        process.exit(1);
      }
      args.tier = value as AndroidParallelTierName;
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

/** The udids a pool of `count` emulators occupies, in the order the suite allocates them. */
function poolUdids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `emulator-${BASE_PORT + i * 2}`);
}

/** Emulators currently attached and past boot, by udid. */
function attachedEmulators(): Set<string> {
  const adb = getAdbFullPath();
  const result = spawnSync(adb, ['devices'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\`${adb} devices\` failed:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }

  return new Set(
    result.stdout
      .split('\n')
      .slice(1)
      .map(line => line.trim().split(/\s+/))
      // Only `device`; an emulator still in `offline` cannot take a session and would fail mid-run.
      .filter(([udid, state]) => udid?.startsWith('emulator-') && state === 'device')
      .map(([udid]) => udid)
  );
}

/**
 * Refuse before Playwright starts if the pool the run needs is not up.
 *
 * Worth doing here because nothing downstream does: `global-setup` only checks this arithmetic for
 * iOS, so an over-subscribed Android run reaches the tests and fails each one individually with
 * `Invalid actual capability given: N`, which reads as a suite bug rather than a missing emulator.
 */
function requirePool(needed: number): void {
  if (needed > MAX_EMULATORS) {
    console.error(
      `This run needs ${needed} emulators but the suite declares ${MAX_EMULATORS} udids ` +
        `(MAX_EMULATORS in scripts/android_config.ts).`
    );
    process.exit(1);
  }

  const wanted = poolUdids(needed);
  const attached = attachedEmulators();
  const missing = wanted.filter(udid => !attached.has(udid));
  if (missing.length) {
    console.error(
      `\nThis run needs ${needed} emulator(s) on ${wanted.join(', ')}, but ` +
        `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not attached.\n\n` +
        `Appium does not boot emulators — start them first:\n` +
        `  pnpm create-emulators ${needed}\n`
    );
    process.exit(1);
  }

  console.log(`✓ ${needed} emulator(s) attached: ${wanted.join(', ')}`);
}

function validate(args: ParsedArgs): number {
  if (!process.env.ANDROID_APK) {
    console.error('ANDROID_APK is not set — point it at a QA/AQA build first.');
    process.exit(1);
  }
  // Validated before anything runs: an unknown value (a "devent" typo) would otherwise be caught
  // only once global-setup resolves the network, after the pool check has already passed.
  if (args.network && !ALLOWED_NETWORKS.includes(args.network as ServiceNetwork)) {
    console.error(`Invalid --network "${args.network}". Use ${ALLOWED_NETWORKS.join(' | ')}.`);
    process.exit(1);
  }

  if (args.tier) {
    if (args.explicitPools) {
      console.error(
        '--tier sets the workers and devices for each pass; drop --workers/--devices-per-worker.'
      );
      process.exit(1);
    }
    return devicesRequired(ANDROID_PARALLEL_TIERS[args.tier]);
  }

  if (!Number.isInteger(args.workers) || args.workers < 1) {
    console.error(`--workers must be a positive integer, got "${args.workers}".`);
    process.exit(1);
  }
  if (!Number.isInteger(args.devicesPerWorker) || args.devicesPerWorker < 1) {
    console.error(
      `--devices-per-worker must be a positive integer, got "${args.devicesPerWorker}".`
    );
    process.exit(1);
  }

  return args.workers * args.devicesPerWorker;
}

function printTiers(): void {
  console.log(
    '\nAvailable tiers (worker counts are unmeasured — see run/constants/parallelism.ts):\n'
  );
  for (const name of ANDROID_PARALLEL_TIER_NAMES) {
    const tier = ANDROID_PARALLEL_TIERS[name];
    console.log(`  ${name} — ${tier.summary}`);
    console.log(`    emulators needed: ${devicesRequired(tier)}`);
    for (const pass of tier.passes) {
      console.log(
        `      @${pass.devices}-devices  x${pass.workers} worker(s)  ` +
          `(${pass.devices * pass.workers} emulators)`
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

function printTierSummary(name: string, results: { pass: ParallelPass; code: number }[]): void {
  console.log(`\n=== tier "${name}" summary ===`);
  for (const { pass, code } of results) {
    const status = code === 0 ? 'pass' : `FAILED (exit ${code})`;
    console.log(`  @${pass.devices}-devices x${pass.workers} worker(s): ${status}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.listTiers) {
    printTiers();
    return;
  }

  const needed = validate(args);
  requirePool(needed);

  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  childEnv.PLATFORM = 'android';
  childEnv.PLAYWRIGHT_WORKERS_COUNT_ANDROID = String(args.workers);
  childEnv.DEVICES_PER_TEST_COUNT = String(args.devicesPerWorker);
  // Silences the driver's per-command logging; a tiered run is long enough that the noise buries
  // the reporter's own output.
  childEnv._TESTING = childEnv._TESTING ?? '1';
  // Left unset otherwise, so .env's NETWORK_TARGET is respected.
  if (args.network) {
    childEnv.NETWORK_TARGET = args.network;
  }

  try {
    if (args.tier) {
      const tier = ANDROID_PARALLEL_TIERS[args.tier];
      const results: { pass: ParallelPass; code: number }[] = [];

      for (const pass of tier.passes) {
        // The pass owns the platform and device-count filter; a caller-supplied --grep is ANDed on
        // top as a further lookahead rather than replacing it.
        const grep =
          args.grep === DEFAULT_GREP
            ? passGrep(pass, 'android')
            : `${passGrep(pass, 'android')}(?=.*${args.grep})`;

        console.log(
          `\n=== tier "${args.tier}": @${pass.devices}-devices, ${pass.workers} worker(s), ` +
            `${pass.devices * pass.workers} emulator(s) ===`
        );

        const code = await runPlaywright(
          [
            'playwright',
            'test',
            '--project',
            'mobile',
            '--grep',
            grep,
            // An empty pass is not a failure: an extra --grep can legitimately clear one device
            // class while the others still have work to do.
            '--pass-with-no-tests',
            ...args.passthrough,
          ],
          {
            ...childEnv,
            DEVICES_PER_TEST_COUNT: String(pass.devices),
            PLAYWRIGHT_WORKERS_COUNT_ANDROID: String(pass.workers),
          }
        );
        // Deliberately not bailing on the first failure — a regression run is worth completing so
        // you see every device class, not just up to the first one that broke.
        results.push({ pass, code });
      }

      printTierSummary(args.tier, results);
      process.exit(results.some(r => r.code !== 0) ? 1 : 0);
    }

    const code = await runPlaywright(
      ['playwright', 'test', '--project', 'mobile', '--grep', args.grep, ...args.passthrough],
      childEnv
    );
    // Preserve the child's exit status so CI/other callers see the real result.
    process.exit(code);
  } catch (err) {
    console.error('Failed to start Playwright:', err);
    process.exit(1);
  }
}

void main();
