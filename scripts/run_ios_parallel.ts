import { spawn } from 'child_process';
import dotenv from 'dotenv';

import type { ServiceNetwork } from '../run/types/target';

import {
  PARALLEL_TIER_NAMES,
  PARALLEL_TIERS,
  type ParallelPass,
  type ParallelTierName,
  passGrep,
  simulatorsRequired,
} from '../run/constants/parallelism';
import { type Simulator } from '../run/test/utils/capabilities_ios';
import { ALLOWED_NETWORKS } from '../run/test/utils/network_target';
import { ensureWdaBuilt } from './build_wda';
import { createIOSSimulators, resolveDeviceConfig } from './create_ios_simulators';
import { deleteSimulators } from './ios_shared';

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

type ParsedArgs = {
  workers: number;
  devicesPerWorker: number;
  grep: string;
  keep: boolean;
  tier?: ParallelTierName;
  listTiers: boolean;
  /** Set when the caller passed --workers/--devices-per-worker, so --tier can reject the combination. */
  explicitPools: boolean;
  runtime?: string;
  network?: string;
  passthrough: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    workers: 2,
    devicesPerWorker: 2,
    grep: DEFAULT_GREP,
    keep: false,
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
    if (arg === '--keep') {
      args.keep = true;
    } else if (arg === '--list-tiers') {
      args.listTiers = true;
    } else if (arg.startsWith('--tier')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      if (!PARALLEL_TIER_NAMES.includes(value as ParallelTierName)) {
        console.error(`Invalid --tier "${value}". Use ${PARALLEL_TIER_NAMES.join(' | ')}.`);
        process.exit(1);
      }
      args.tier = value as ParallelTierName;
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
    } else if (arg.startsWith('--runtime')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.runtime = value;
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

function validate(args: ParsedArgs): number {
  if (!process.env.IOS_APP_PATH_PREFIX) {
    console.error('IOS_APP_PATH_PREFIX is not set — point it at a simulator Session.app first.');
    process.exit(1);
  }
  // Validate --network before provisioning: an unknown value (e.g. a "devent" typo) would
  // otherwise create the whole simulator pool and spawn Playwright before failing downstream.
  if (args.network && !ALLOWED_NETWORKS.includes(args.network as ServiceNetwork)) {
    console.error(`Invalid --network "${args.network}". Use ${ALLOWED_NETWORKS.join(' | ')}.`);
    process.exit(1);
  }
  if (args.tier) {
    if (args.explicitPools) {
      console.error(
        `--tier sets devices-per-worker and workers per pass, so it cannot be combined with ` +
          `--workers / --devices-per-worker. Drop one or the other.`
      );
      process.exit(1);
    }
    const needed = simulatorsRequired(PARALLEL_TIERS[args.tier]);
    if (needed > MAX_SIMULATORS) {
      console.error(
        `Tier "${args.tier}" needs ${needed} simulators, but the maximum is ${MAX_SIMULATORS}.`
      );
      process.exit(1);
    }
    return needed;
  }
  if (isNaN(args.workers) || args.workers < 1) {
    console.error(`Invalid --workers value: ${args.workers}`);
    process.exit(1);
  }
  if (isNaN(args.devicesPerWorker) || args.devicesPerWorker < 1) {
    console.error(`Invalid --devices-per-worker value: ${args.devicesPerWorker}`);
    process.exit(1);
  }
  const totalSimulators = args.workers * args.devicesPerWorker;
  if (totalSimulators > MAX_SIMULATORS) {
    console.error(
      `Requested ${args.workers} workers x ${args.devicesPerWorker} devices-per-worker = ` +
        `${totalSimulators} simulators, but the maximum is ${MAX_SIMULATORS}. ` +
        `Lower --workers or --devices-per-worker.`
    );
    process.exit(1);
  }
  return totalSimulators;
}

function printKeepInfo(simulators: Simulator[]): void {
  console.log(`\nLeaving ${simulators.length} simulator(s) in place (--keep).`);
  console.log('To reuse them with `pnpm test-ios`, put these lines in your .env:\n');
  simulators.forEach((sim, i) => console.log(`IOS_${i + 1}_SIMULATOR=${sim.udid}`));
  console.log('\nSimulator diagnostic logs live under ~/Library/Logs/CoreSimulator/<udid>/');
  console.log('Delete them later with `pnpm cleanup-simulators` (after adding them to .env) or');
  console.log('`xcrun simctl delete <udid>`.\n');
}

function printTiers(): void {
  console.log('\nAvailable tiers (see run/constants/parallelism.ts for the measurements):\n');
  for (const name of PARALLEL_TIER_NAMES) {
    const tier = PARALLEL_TIERS[name];
    console.log(`  ${name} — ${tier.summary}`);
    console.log(`    simulators needed: ${simulatorsRequired(tier)}`);
    for (const pass of tier.passes) {
      console.log(
        `      @${pass.devices}-devices  x${pass.workers} worker(s)  ` +
          `(${pass.devices * pass.workers} sims)`
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
      const tier = PARALLEL_TIERS[args.tier];
      const results: { pass: ParallelPass; code: number }[] = [];

      for (const pass of tier.passes) {
        // The pass owns the platform and device-count filter; a caller-supplied --grep is ANDed on
        // top as a further lookahead rather than replacing it, so `--grep '@ios @high-risk'` narrows
        // each pass instead of selecting the wrong device class.
        const grep =
          args.grep === DEFAULT_GREP ? passGrep(pass) : `${passGrep(pass)}(?=.*${args.grep})`;

        console.log(
          `\n=== tier "${args.tier}": @${pass.devices}-devices, ${pass.workers} worker(s), ` +
            `${pass.devices * pass.workers} simulator(s) ===`
        );

        const code = await runPlaywright(
          [
            'playwright',
            'test',
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
            PLAYWRIGHT_WORKERS_COUNT_IOS: String(pass.workers),
          }
        );
        // Deliberately not bailing on the first failure — a regression run is worth completing so
        // you see every device class, not just up to the first one that broke.
        results.push({ pass, code });
      }

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
