import { FullConfig } from '@playwright/test';

import { getDevicesPerTestCount, getWorkersCount } from './run/test/utils/binaries';
import { getNetworkTarget } from './run/test/utils/devnet';
import { SupportedPlatformsType } from './run/test/utils/open_app';
import { ensureWdaBuilt } from './scripts/build_wda';
import {
  bootSimulatorPool,
  installAppOnSimulators,
  launchWdaOnSimulators,
  resolveRunSimulators,
} from './scripts/ios_shared';

/**
 * Does this run target iOS? `PLATFORM` is set on CI and by run_ios_parallel; otherwise fall back to
 * looking for the `@ios` tag filter that every iOS run greps on (see run/types/sessionIt.ts).
 *
 * The tag is read from `process.argv` rather than `config.grep`, because Playwright applies a CLI
 * `--grep` as a separate filter and leaves `config.grep` as its match-everything default.
 *
 * Conservative by design: when we can't tell (e.g. running a spec file directly with no tag
 * filter), we skip pre-booting and leave Appium to boot on demand, exactly as before.
 */
function isIosRun(platform: string | undefined): boolean {
  if (platform) {
    return platform === 'ios';
  }
  return process.argv.slice(2).some(arg => /@ios/i.test(arg));
}

export default async function globalSetup(_config: FullConfig) {
  const platform = process.env.PLATFORM as SupportedPlatformsType | undefined;

  if (platform) {
    console.log(`Validating build/network configuration...`);
    await getNetworkTarget(platform); // already logs and throws on error, no need to duplicate it in global config
  } else {
    // The CI knows the platform variable, this is for local development
    console.log('No PLATFORM variable set, network validation will happen on a per-test level');
  }

  // Build the WebDriverAgent runner everywhere, including CI. This is separate from booting
  // simulators and launching WDA on them (below, local only): with the runner built,
  // `capabilities_ios` passes `usePreinstalledWDA` + `prebuiltWDAPath`, so the driver installs it with
  // `simctl` rather than running `xcodebuild` inside every session — the slowest and flakiest part of
  // a cold session. It needs no booted device (`-destination 'generic/platform=iOS Simulator'`) and
  // costs ~31s once per job, against a per-session build otherwise.
  if (isIosRun(platform)) {
    try {
      ensureWdaBuilt();
    } catch (error: unknown) {
      // Best-effort: without it the driver builds WDA per session, as it did before any of this.
      console.warn(
        `Could not build WebDriverAgent (sessions will build their own): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Pre-booting the pool and pre-launching WDA on it is local only. Pre-booting is a prerequisite for
  // the launch (`simctl launch` needs a booted device) and uses `simctl bootstatus -b`, which waits for
  // boot to genuinely finish rather than boot-then-sleep.
  //
  // Off on CI because it cost more than it saved there: preparing the 12-simulator pool took 350s of
  // dead time before the first test, and WebDriverAgent came up on only 1 of those 12 — the fixed
  // port-binding window in launchWdaOnSimulators does not hold when 12 launches contend — so 11
  // devices paid the per-session cost anyway. Setup went from 67s to 523s.
  //
  // That 350s *is* partly a scheduling problem, contrary to what this comment used to claim: booting
  // eight cold simulators one at a time was later measured at ~11s each, against the ~29s each the
  // 12-simulator pool averaged booting all at once. Boot contention is most of the cost, so capping
  // the width should recover much of it — hence IOS_BOOT_CONCURRENCY in bootSimulatorPool.
  //
  // What lazy booting buys on top of that is *overlap* — each worker boots what it needs while other
  // workers are already running tests, and with the tiered passes the first pass warms the pool for
  // the three that follow.
  //
  // Set IOS_PREPARE_SIMULATORS=1 to measure it on CI again — worth revisiting for high worker counts,
  // where the per-session WDA *launch* serialisation it removes is exactly what hurts. The WDA port
  // window and launch concurrency still need addressing before it wins outright.
  const prepareSimulators = process.env.CI !== '1' || process.env.IOS_PREPARE_SIMULATORS === '1';

  if (isIosRun(platform) && !prepareSimulators) {
    console.log(
      'Skipping simulator pre-boot and WDA pre-launch on CI — Appium boots on demand, sessions ' +
        'reuse the prebuilt WDA runner (set IOS_PREPARE_SIMULATORS=1 to enable).'
    );
  }

  if (isIosRun(platform) && prepareSimulators) {
    const isCI = process.env.CI === '1';
    const workers = getWorkersCount('ios');
    const devicesPerWorker = getDevicesPerTestCount();

    // Resolved from .env locally and ci-simulators.json on CI, each carrying its wdaLocalPort.
    const available = resolveRunSimulators();
    // Each booted simulator costs the host ~280 processes, so booting more than the run can use
    // would slow it down rather than speed it up. Prepare exactly the pool the workers will
    // allocate from (see openiOSApp in open_app.ts for the offsetting).
    const pool = available.slice(0, Math.min(workers * devicesPerWorker, available.length));
    await bootSimulatorPool(pool.map(sim => sim.udid));

    // Install the app up front too: on a simulator that doesn't already have it, Appium's install
    // happens inside the first session and dominates that test (~150s for 3 devices, vs ~17s warm).
    // `simctl install` is an upsert, so this is a no-op once the app is present and unchanged.
    if (process.env.IOS_APP_PATH_PREFIX) {
      await installAppOnSimulators(
        pool.map(sim => sim.udid),
        process.env.IOS_APP_PATH_PREFIX
      );
    }

    // Start one long-lived WebDriverAgent per simulator and tell the workers (via env, which they
    // inherit when Playwright spawns them after this hook) which ports to attach to. Saves ~8s on a
    // 3-device test by removing the per-session WDA install and its cross-device serialisation.
    // Ports that don't come up are simply omitted, and those devices fall back to the driver's own
    // WDA handling — see getIosCapabilities.
    //
    // Building WDA here (rather than only in run_ios_parallel) is what makes this work on CI, whose
    // runners are ephemeral and have no prebuilt runner. It is a one-off cost per job that replaces
    // the driver's per-session xcodebuild.
    try {
      const wdaPath = ensureWdaBuilt();
      const readyPorts = await launchWdaOnSimulators(
        pool.map(sim => ({ udid: sim.udid, port: sim.wdaPort })),
        wdaPath
      );
      if (readyPorts.length > 0) {
        process.env.WDA_REUSE_PORTS = readyPorts.join(',');
      }
    } catch (error: unknown) {
      // Never block a run on this: without it the driver builds and launches WDA itself, as before.
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Could not prepare WebDriverAgent (falling back to the driver's own): ${message}`
      );
    }

    if (!isCI && workers > 1) {
      console.warn(
        `\n⚠️  Running ${workers} Playwright workers x ${devicesPerWorker} device(s) = ` +
          `${workers * devicesPerWorker} simulators.\n` +
          `   Each booted simulator spawns ~280 processes, so multiple workers can saturate the\n` +
          `   host and cause tests to fail on timeouts that have nothing to do with the app.\n` +
          `   If you see unexplained "element not found" failures, re-run with 1 worker to confirm.\n`
      );
    }
  }
}
