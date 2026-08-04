import { FullConfig } from '@playwright/test';

import { getDevicesPerTestCount, getWorkersCount } from './run/test/utils/binaries';
import {
  assertRequestedDevnetsReachable,
  getNetworkTarget,
  pinPlatformsToNetworkTarget,
  requestedDevnetRefs,
} from './run/test/utils/devnet';
import { resolveDevnetSeedNode } from './run/test/utils/network_target';
import { SupportedPlatformsType } from './run/test/utils/open_app';
import { ensureWdaBuilt } from './scripts/build_wda';
import {
  discoverRunningWda,
  prepareSimulatorPool,
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

/** Set by scripts/prepare_ios.ts when a CI step has already prepared the pool. */
const PREPARED_FLAG = 'IOS_SIMULATORS_PREPARED';

export default async function globalSetup(_config: FullConfig) {
  // NETWORK_TARGET is the single switch: translate it into the per-platform knob each client reads
  // at launch (currently only Desktop needs one). No-op when it isn't set, so per-platform setups
  // keep working unchanged.
  pinPlatformsToNetworkTarget();

  // Discover the devnet's pubkey/ip/storage ports from the seed node itself, once per run and before
  // any client starts. Done here rather than lazily because the capability builders are synchronous,
  // and because failing in global setup gives a single clear error instead of one per device.
  if (requestedDevnetRefs().length > 0) {
    await resolveDevnetSeedNode();
  }

  // Runs for EVERY project (mobile, desktop, cross-platform) and regardless of PLATFORM: if this
  // environment asks for devnet anywhere and that devnet is not usable, stop the whole run here
  // rather than letting each platform discover it separately (or, for Desktop, not at all).
  await assertRequestedDevnetsReachable();

  const platform = process.env.PLATFORM as SupportedPlatformsType | undefined;

  if (platform) {
    console.log(`Validating build/network configuration...`);
    await getNetworkTarget(platform); // already logs and throws on error, no need to duplicate it in global config
  } else {
    // The CI knows the platform variable, this is for local development
    console.log('No PLATFORM variable set, network validation will happen on a per-test level');
  }

  // Get the simulator pool ready before the workers start: booted, app installed, and one long-lived
  // WebDriverAgent per device. Without it the first test to touch a device pays its cold boot, its app
  // install, and a WDA launch inline — and with `appium:webDriverAgentUrl` pointing at a running WDA the
  // driver's launch collapses to a single `/status` call, removing the per-session install and the
  // process-wide lock it serialises behind (~8s on a 3-device test).
  //
  // Everything here is best-effort with a working fallback, so it degrades rather than failing.
  if (isIosRun(platform)) {
    const isCI = process.env.CI === '1';
    const workers = getWorkersCount('ios');
    const devicesPerWorker = getDevicesPerTestCount();

    // Resolved from .env locally and ci-simulators.json on CI, each carrying its wdaLocalPort.
    const available = resolveRunSimulators();
    // Each booted simulator costs the host ~230 processes, so preparing more than the run can use would
    // slow it down rather than speed it up. Prepare exactly the pool the workers will allocate from
    // (see openiOSApp in open_app.ts for the offsetting).
    const pool = available.slice(0, Math.min(workers * devicesPerWorker, available.length));

    // Already prepared by the `Prepare simulators` CI step (scripts/prepare_ios.ts), so just find the
    // WebDriverAgents it started. The tiered CI run invokes Playwright once per device class, which
    // means this hook runs several times per job — repeating twelve app installs each time would cost
    // more than it saves, and re-launching a working WDA would throw away a warm one.
    if (process.env[PREPARED_FLAG] === '1') {
      const readyPorts = await discoverRunningWda(pool);
      console.log(
        `Simulators already prepared by an earlier step; WebDriverAgent found on ` +
          `${readyPorts.length}/${pool.length}.`
      );
      if (readyPorts.length > 0) {
        process.env.WDA_REUSE_PORTS = readyPorts.join(',');
      }
    } else {
      // Building WDA here (rather than only in run_ios_parallel) is what makes this work on a runner
      // with no prebuilt runner: a one-off cost per job replacing the driver's per-session xcodebuild.
      let wdaAppPath: string | undefined;
      try {
        wdaAppPath = ensureWdaBuilt();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Could not build WebDriverAgent (the driver will build its own): ${message}`);
      }

      const readyPorts = await prepareSimulatorPool(pool, {
        appPath: process.env.IOS_APP_PATH_PREFIX,
        wdaAppPath,
      });
      // Passed to the workers through the environment, which they inherit when Playwright spawns them
      // after this hook. Ports that didn't come up are simply absent, and those devices fall back to
      // the driver's own WDA handling — see getIosCapabilities.
      if (readyPorts.length > 0) {
        process.env.WDA_REUSE_PORTS = readyPorts.join(',');
      }
    }

    if (!isCI && workers > 1) {
      console.warn(
        `\n⚠️  Running ${workers} Playwright workers x ${devicesPerWorker} device(s) = ` +
          `${workers * devicesPerWorker} simulators.\n` +
          `   Each booted simulator spawns ~230 processes, so multiple workers can saturate the\n` +
          `   host and cause tests to fail on timeouts that have nothing to do with the app.\n` +
          `   If you see unexplained "element not found" failures, re-run with 1 worker to confirm.\n`
      );
    }
  }
}
