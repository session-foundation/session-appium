import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

import {
  ANDROID_PARALLEL_TIER_NAMES,
  ANDROID_PARALLEL_TIERS,
  type AndroidParallelTierName,
} from '../run/constants/parallelism';
import { getAdbFullPath } from '../run/test/utils/binaries';
import { BASE_PORT, MAX_EMULATORS } from './android_config';
import {
  type ParallelArgsBase,
  parseParallelArgs,
  printTiers,
  printTierSummary,
  runPlaywright,
  runTierPasses,
  validateParallelArgs,
} from './parallel_shared';

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

type ParsedArgs = ParallelArgsBase & { tier?: AndroidParallelTierName };

function parseArgs(argv: string[]): ParsedArgs {
  return parseParallelArgs<ParsedArgs>({
    argv,
    tierNames: ANDROID_PARALLEL_TIER_NAMES,
    defaults: {
      // Defaults to the whole suite on one worker: the pool has to be booted already, so guessing at
      // a wider one would fail the pool check rather than run anything.
      workers: 1,
      devicesPerWorker: 4,
      grep: DEFAULT_GREP,
      listTiers: false,
      explicitPools: false,
      passthrough: [],
    },
  });
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
  // `needed <= MAX_EMULATORS` already, from the shared validator.
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

  return validateParallelArgs({
    args,
    tiers: ANDROID_PARALLEL_TIERS,
    maxDevices: MAX_EMULATORS,
    deviceNoun: 'emulator',
  });
}

function showTiers(): void {
  printTiers({
    tiers: ANDROID_PARALLEL_TIERS,
    tierNames: ANDROID_PARALLEL_TIER_NAMES,
    deviceNoun: 'emulator',
    preamble: 'Available tiers (worker counts are unmeasured — see run/constants/parallelism.ts):',
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.listTiers) {
    showTiers();
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

  // `--project mobile` because the Android specs share the project with iOS and, unlike `@ios`, the
  // `@android` tag alone does not exclude the desktop project's own titles.
  const projectArgs = ['--project', 'mobile'];

  try {
    if (args.tier) {
      const results = await runTierPasses({
        tierName: args.tier,
        tier: ANDROID_PARALLEL_TIERS[args.tier],
        platform: 'android',
        grep: args.grep,
        defaultGrep: DEFAULT_GREP,
        workersEnvVar: 'PLAYWRIGHT_WORKERS_COUNT_ANDROID',
        deviceNoun: 'emulator',
        baseEnv: childEnv,
        playwrightArgs: projectArgs,
        passthrough: args.passthrough,
      });

      printTierSummary(args.tier, results);
      process.exit(results.some(r => r.code !== 0) ? 1 : 0);
    }

    const code = await runPlaywright(
      ['playwright', 'test', ...projectArgs, '--grep', args.grep, ...args.passthrough],
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
