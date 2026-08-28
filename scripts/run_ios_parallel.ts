import dotenv from 'dotenv';

import {
  PARALLEL_TIER_NAMES,
  PARALLEL_TIERS,
  type ParallelTierName,
} from '../run/constants/parallelism';
import { type Simulator } from '../run/test/utils/capabilities_ios';
import { ensureWdaBuilt } from './build_wda';
import { createIOSSimulators, resolveDeviceConfig } from './create_ios_simulators';
import { deleteSimulators } from './ios_shared';
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
 * Self-contained parallel iOS test runner.
 *
 * Creates a throwaway pool of media-preloaded simulators, runs the iOS suite across multiple
 * Playwright workers against them, then deletes the simulators when the run finishes OR is
 * cancelled (Ctrl+C). Pass `--keep` to leave the simulators (and their logs) behind for
 * inspection or for reuse with `pnpm test-ios`.
 *
 * Why this exists: locally the suite runs single-worker, so ~250 iOS tests execute one at a
 * time. Each Playwright worker owns a fixed pool of `--devices-per-worker` simulators (offset by its
 * worker index — see openiOSApp in open_app.ts), so N workers need N * devices simulators.
 * This script provisions exactly that many, wires their UDIDs into the child process's
 * environment (without touching your .env), and cleans up after itself.
 *
 * Usage:
 *   pnpm test-ios-parallel --tier standard          # tiered: one pass per device class (recommended)
 *   pnpm test-ios-parallel --list-tiers             # show the tiers and what they cost
 *   pnpm test-ios-parallel                                      # 2 workers x 2 devices (4 sims), grep @ios
 *   pnpm test-ios-parallel --devices-per-worker 4               # 2 workers x 4 devices (8 sims)
 *   pnpm test-ios-parallel --workers 3 --devices-per-worker 4   # 3 workers x 4 devices (12 sims)
 *   pnpm test-ios-parallel --grep '@ios @high-risk'             # subset
 *   pnpm test-ios-parallel --keep                   # don't delete simulators afterwards
 *   pnpm test-ios-parallel --runtime 26.1           # pin the iOS runtime (default: newest)
 *   pnpm test-ios-parallel --network devnet         # run against devnet (needs DEVNET_SEED_URL in .env)
 *   pnpm test-ios-parallel --workers 2 -- --repeat-each 2   # args after `--` go to Playwright
 *
 * Notes:
 *   - `--network` selects the service network (mainnet | testnet | devnet; default mainnet).
 *     devnet also requires DEVNET_SEED_URL in .env (the seed node's oxend RPC; see .env.sample) and
 *     a reachable devnet — running against devnet avoids full mainnet onion-routing latency, the
 *     dominant cost of the slowest multi-device tests. The pubkey and storage ports are discovered
 *     from the seed node, so no other DEVNET_* value is needed.
 *   - `--runtime` picks the iOS simulator runtime (a version like "26.1" or a full identifier).
 *     If omitted, the preferred runtime is used when installed, otherwise the newest installed
 *     iOS runtime. Device type is overridable via the IOS_SIM_DEVICE_TYPE env var.
 *   - `--tier` runs one Playwright invocation per device class (see run/constants/parallelism.ts),
 *     each with its own devices-per-worker and worker count. This exists because
 *     `DEVICES_PER_TEST_COUNT` is a single global per invocation, so a single run has to size its
 *     pools for the largest spec and wastes simulators on every smaller one. Passes run in sequence,
 *     so the pool is the largest pass, not the sum. `--tier` replaces `--workers` /
 *     `--devices-per-worker`; combining them is rejected. A `--grep` given alongside `--tier` is
 *     ANDed in as an extra lookahead on top of the pass's own platform/device-count filter.
 *     A failing pass does not stop the remaining passes — you get the whole picture, and the exit
 *     status is non-zero if any pass failed.
 *   - `--devices-per-worker` is the per-worker simulator pool. It must be >=
 *     the largest test's device count in your grep, otherwise those tests fail fast with a clear
 *     error (see openiOSApp). The default of 2 covers @1-devices / @2-devices tests; use
 *     `--devices-per-worker 4` to include the @3-devices / @4-devices tests (i.e. the full suite).
 *     Total simulators created = workers x devices-per-worker.
 *   - Simulators are created shut down; `global-setup.ts` then pre-boots the pool, pre-installs the
 *     app and starts a WebDriverAgent per simulator before any test runs.
 *   - Prefer `--workers 1`. Each booted simulator spawns ~280 host processes, so more workers
 *     saturate the machine and produce timeout failures unrelated to the app — see CLAUDE.md.
 *   - Total simulators (workers * devices) must not exceed 12 (the IOS_N_SIMULATOR cap).
 *   - Creating simulators has a one-off cost (clone + media). For fast iteration, run once with
 *     `--keep`, paste the printed IOS_N_SIMULATOR lines into .env, then use `pnpm test-ios`.
 */

dotenv.config({ quiet: true });

const MAX_SIMULATORS = 12;

const DEFAULT_GREP = '@ios';

type ParsedArgs = ParallelArgsBase & {
  keep: boolean;
  tier?: ParallelTierName;
  runtime?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  return parseParallelArgs<ParsedArgs>({
    argv,
    tierNames: PARALLEL_TIER_NAMES,
    defaults: {
      workers: 2,
      devicesPerWorker: 2,
      grep: DEFAULT_GREP,
      keep: false,
      listTiers: false,
      explicitPools: false,
      passthrough: [],
    },
    extra: {
      boolean: { '--keep': args => void (args.keep = true) },
      value: { '--runtime': (args, value) => void (args.runtime = value) },
    },
  });
}

function validate(args: ParsedArgs): number {
  if (!process.env.IOS_APP_PATH_PREFIX) {
    console.error('IOS_APP_PATH_PREFIX is not set — point it at a simulator Session.app first.');
    process.exit(1);
  }

  return validateParallelArgs({
    args,
    tiers: PARALLEL_TIERS,
    maxDevices: MAX_SIMULATORS,
    deviceNoun: 'simulator',
  });
}

function printKeepInfo(simulators: Simulator[]): void {
  console.log(`\nLeaving ${simulators.length} simulator(s) in place (--keep).`);
  console.log('To reuse them with `pnpm test-ios`, put these lines in your .env:\n');
  simulators.forEach((sim, i) => console.log(`IOS_${i + 1}_SIMULATOR=${sim.udid}`));
  console.log('\nSimulator diagnostic logs live under ~/Library/Logs/CoreSimulator/<udid>/');
  console.log('Delete them later with `pnpm cleanup-simulators` (after adding them to .env) or');
  console.log('`xcrun simctl delete <udid>`.\n');
}

function showTiers(): void {
  printTiers({
    tiers: PARALLEL_TIERS,
    tierNames: PARALLEL_TIER_NAMES,
    deviceNoun: 'simulator',
    preamble: 'Available tiers (see run/constants/parallelism.ts for the measurements):',
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.listTiers) {
    showTiers();
    return;
  }
  const totalSimulators = validate(args);

  // Build the WebDriverAgent runner once up front so the driver reuses it across every simulator
  // instead of building/launching WDA per session (the slowest, flakiest part of a cold-sim
  // startup). No-op once built — see scripts/build_wda.ts.
  ensureWdaBuilt();

  console.log(
    `\nProvisioning ${totalSimulators} simulator(s) for ${args.workers} worker(s) ` +
      `x ${args.devicesPerWorker} device(s) per worker...`
  );

  const deviceConfig = resolveDeviceConfig({ runtime: args.runtime });
  const simulators = createIOSSimulators({ ...deviceConfig, totalSimulators });

  // Inject the freshly-created UDIDs into the child's environment only. capabilities_ios reads
  // IOS_N_SIMULATOR from process.env; dotenv.config() there does NOT override already-set vars,
  // so these win over any .env entries and the developer's .env is left untouched.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  simulators.forEach((sim, i) => {
    childEnv[`IOS_${i + 1}_SIMULATOR`] = sim.udid;
  });
  childEnv.PLATFORM = 'ios';
  childEnv.PLAYWRIGHT_WORKERS_COUNT_IOS = String(args.workers);
  childEnv.DEVICES_PER_TEST_COUNT = String(args.devicesPerWorker);
  childEnv._TESTING = childEnv._TESTING ?? '1';
  // Service network selection. Devnet also needs DEVNET_SEED_URL in .env — the pubkey and storage
  // ports are discovered from that seed node (see run/test/utils/network_target.ts), so nothing else
  // is required. Left unset here so .env's NETWORK_TARGET is respected.
  if (args.network) {
    childEnv.NETWORK_TARGET = args.network;
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    if (args.keep) {
      printKeepInfo(simulators);
      return;
    }
    console.log('\nDeleting temporary simulators...');
    const deleted = deleteSimulators(simulators.map(s => s.udid));
    console.log(`✓ Deleted ${deleted} simulator(s)`);
  };

  try {
    if (args.tier) {
      const results = await runTierPasses({
        tierName: args.tier,
        tier: PARALLEL_TIERS[args.tier],
        platform: 'ios',
        grep: args.grep,
        defaultGrep: DEFAULT_GREP,
        workersEnvVar: 'PLAYWRIGHT_WORKERS_COUNT_IOS',
        deviceNoun: 'simulator',
        baseEnv: childEnv,
        playwrightArgs: [],
        passthrough: args.passthrough,
      });

      printTierSummary(args.tier, results);
      cleanup();
      process.exit(results.some(r => r.code !== 0) ? 1 : 0);
    }

    const code = await runPlaywright(
      ['playwright', 'test', '--grep', args.grep, ...args.passthrough],
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

void main();
