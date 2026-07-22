import { spawn } from 'child_process';
import dotenv from 'dotenv';

import type { Simulator } from '../run/test/utils/capabilities_ios';

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
 * time. Each Playwright worker owns a fixed pool of `--devices` simulators (offset by its
 * worker index — see openiOSApp in open_app.ts), so N workers need N * devices simulators.
 * This script provisions exactly that many, wires their UDIDs into the child process's
 * environment (without touching your .env), and cleans up after itself.
 *
 * Usage:
 *   pnpm test-ios-parallel                          # 2 workers x 2 devices (4 sims), grep @ios
 *   pnpm test-ios-parallel --devices 4              # 2 workers x 4 devices (8 sims)
 *   pnpm test-ios-parallel --workers 3 --devices 4  # 3 workers x 4 devices (12 sims)
 *   pnpm test-ios-parallel --grep '@ios @high-risk' # subset
 *   pnpm test-ios-parallel --keep                   # don't delete simulators afterwards
 *   pnpm test-ios-parallel --runtime 26.1           # pin the iOS runtime (default: newest)
 *   pnpm test-ios-parallel --network devnet         # run against devnet (needs DEVNET_* in .env)
 *   pnpm test-ios-parallel --workers 2 -- --repeat-each 2   # args after `--` go to Playwright
 *
 * Notes:
 *   - `--network` selects the service network (mainnet | testnet | devnet; default mainnet).
 *     devnet also requires DEVNET_PUBKEY / DEVNET_IP / DEVNET_HTTP_PORT / DEVNET_OMQ_PORT in .env
 *     (see .env.sample) and a reachable devnet — running against devnet avoids full mainnet
 *     onion-routing latency, the dominant cost of the slowest multi-device tests.
 *   - `--runtime` picks the iOS simulator runtime (a version like "26.1" or a full identifier).
 *     If omitted, the preferred runtime is used when installed, otherwise the newest installed
 *     iOS runtime. Device type is overridable via the IOS_SIM_DEVICE_TYPE env var.
 *   - `--devices` is the per-worker simulator pool. It must be >= the largest test's device
 *     count in your grep, otherwise those tests fail fast with a clear error (see openiOSApp).
 *     The default of 2 covers @1-devices / @2-devices tests; use `--devices 4` to include the
 *     @3-devices / @4-devices tests (i.e. the full suite).
 *   - Simulators are created shut down; Appium boots each on demand at session start (as on CI).
 *   - Total simulators (workers * devices) must not exceed 12 (the IOS_N_SIMULATOR cap).
 *   - Creating simulators has a one-off cost (clone + media). For fast iteration, run once with
 *     `--keep`, paste the printed IOS_N_SIMULATOR lines into .env, then use `pnpm test-ios`.
 */

dotenv.config({ quiet: true });

const MAX_SIMULATORS = 12;

type ParsedArgs = {
  workers: number;
  devicesPerTest: number;
  grep: string;
  keep: boolean;
  runtime?: string;
  network?: string;
  passthrough: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    workers: 2,
    devicesPerTest: 2,
    grep: '@ios',
    keep: false,
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
    } else if (arg.startsWith('--workers')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.workers = parseInt(value);
      if (consumedNext) i++;
    } else if (arg.startsWith('--devices')) {
      const [value, consumedNext] = readValue(arg, ownArgs[i + 1]);
      args.devicesPerTest = parseInt(value);
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
  if (isNaN(args.workers) || args.workers < 1) {
    console.error(`Invalid --workers value: ${args.workers}`);
    process.exit(1);
  }
  if (isNaN(args.devicesPerTest) || args.devicesPerTest < 1) {
    console.error(`Invalid --devices value: ${args.devicesPerTest}`);
    process.exit(1);
  }
  const totalSimulators = args.workers * args.devicesPerTest;
  if (totalSimulators > MAX_SIMULATORS) {
    console.error(
      `Requested ${args.workers} workers x ${args.devicesPerTest} devices = ${totalSimulators} ` +
        `simulators, but the maximum is ${MAX_SIMULATORS}. Lower --workers or --devices.`
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const totalSimulators = validate(args);

  console.log(
    `\nProvisioning ${totalSimulators} simulator(s) for ${args.workers} worker(s) ` +
      `x ${args.devicesPerTest} device(s)...`
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
  childEnv.PLAYWRIGHT_WORKERS_COUNT = String(args.workers);
  childEnv.DEVICES_PER_TEST_COUNT = String(args.devicesPerTest);
  childEnv._TESTING = childEnv._TESTING ?? '1';
  // Service network selection (mainnet default). Devnet also needs DEVNET_* vars in .env — see
  // capabilities_ios.ts / .env.sample. Left unset here so .env's NETWORK_TARGET is respected.
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

  const playwrightArgs = ['playwright', 'test', '--grep', args.grep, ...args.passthrough];
  console.log(`\nRunning: npx ${playwrightArgs.join(' ')}\n`);

  const child = spawn('npx', playwrightArgs, { stdio: 'inherit', env: childEnv });

  // Forward interrupts to the child; its 'exit' below then triggers cleanup exactly once.
  const forward = (signal: NodeJS.Signals) => () => child.kill(signal);
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));

  child.on('error', err => {
    console.error('Failed to start Playwright:', err);
    cleanup();
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    cleanup();
    // Preserve the child's exit status so CI/other callers see the real result.
    process.exit(code ?? (signal ? 1 : 0));
  });
}

main();
