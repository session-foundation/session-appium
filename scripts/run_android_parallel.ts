import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

import {
  ANDROID_PARALLEL_TIER_NAMES,
  ANDROID_PARALLEL_TIERS,
  type AndroidParallelTierName,
} from '../run/constants/parallelism';
import { getAdbFullPath } from '../run/test/utils/binaries';
import { BASE_PORT, MAX_EMULATORS } from './android_config';
import { type ParallelArgsBase, runParallelSuite } from './parallel_shared';

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
 * All this runner provisions: nothing. Appium will not boot an emulator, so refuse before Playwright
 * starts if the pool the run needs is not up.
 *
 * Worth doing here because nothing downstream does: `global-setup` only checks this arithmetic for
 * iOS, so an over-subscribed Android run reaches the tests and fails each one individually with
 * `Invalid actual capability given: N`, which reads as a suite bug rather than a missing emulator.
 */
function requirePool(needed: number): void {
  if (!process.env.ANDROID_APK) {
    console.error('ANDROID_APK is not set — point it at a QA/AQA build first.');
    process.exit(1);
  }

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

void runParallelSuite<ParsedArgs>(
  {
    platform: 'android',
    deviceNoun: 'emulator',
    defaultGrep: DEFAULT_GREP,
    workersEnvVar: 'PLAYWRIGHT_WORKERS_COUNT_ANDROID',
    maxDevices: MAX_EMULATORS,
    tiers: ANDROID_PARALLEL_TIERS,
    tierNames: ANDROID_PARALLEL_TIER_NAMES,
    tiersPreamble:
      'Available tiers (worker counts are unmeasured — see run/constants/parallelism.ts):',
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
    prepareDevices: (_args, deviceCount) => requirePool(deviceCount),
  },
  process.argv.slice(2)
);
