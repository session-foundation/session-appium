import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

import { withLogGroup } from '../run/shared/ci_log_groups';

/**
 * Build the WebDriverAgent (WDA) runner ONCE, up front, so the XCUITest driver can reuse it
 * across every simulator instead of building/launching it via `xcodebuild` on each session.
 *
 * Why this exists: freshly-created simulators (see run_ios_parallel.ts / create_ios_simulators.ts)
 * have no WDA installed, so without a prebuilt runner the driver rebuilds+launches WDA per session
 * via `xcodebuild test`. On a cold, just-booted clone that step is both the slowest part of session
 * startup AND the flakiest — it intermittently dies before binding `wdaLocalPort`, surfacing as
 * `Unable to start WebDriverAgent session ... ECONNREFUSED 127.0.0.1:<port>`. It also causes the
 * app-under-test to be installed, WDA brought up, then the app reinstalled around the test runner.
 *
 * Building once here + pointing the caps at it (appium:prebuiltWDAPath / usePreinstalledWDA /
 * derivedDataPath in capabilities_ios.ts) removes `xcodebuild` from the per-session loop entirely:
 * the driver installs the prebuilt runner with `simctl` and launches it directly.
 *
 * Output lives under the gitignored `build/` folder so it never touches the shared Xcode
 * DerivedData directory (which is unlikely to be cleaned up and would silently eat disk).
 *
 * Usage:
 *   pnpm build-wda            # build if missing (no-op when already built)
 *   pnpm build-wda --force    # rebuild even if a prebuilt runner already exists
 *
 * Overrides:
 *   WDA_DERIVED_DATA_PATH   absolute derived-data dir (default: <repo>/build/wda/derived)
 *   WDA_PREBUILT_WDA_PATH   absolute path to the prebuilt *-Runner.app (default: derived from above)
 *   BUILD_LOCK_CMD          command prefix that serialises heavy builds (default: none, build directly)
 */

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Optional prefix that serialises this build against other heavy builds on the same machine.
 *
 * Unset by default, so a plain checkout and CI build exactly as before. It exists for shared hosts
 * where something else may be compiling a Session client at the same time: this is a full `xcodebuild`
 * of WebDriverAgent, and two native builds at once is the load pattern that pushes a machine into swap
 * and produces test timeouts indistinguishable from product bugs.
 *
 * Set it to a command that runs its `--`-separated argument under a mutex, e.g.
 * `BUILD_LOCK_CMD="/path/to/build-lock.sh run Session_iOS <owner> --"`. Kept as an opaque prefix rather
 * than a path plus flags so this file needs no knowledge of the locking tool's CLI, and so a machine
 * with a different one can use it unchanged.
 */
const BUILD_LOCK_CMD = process.env.BUILD_LOCK_CMD?.trim();

/** Derived-data directory WDA is built into (env-overridable). */
export const WDA_DERIVED_DATA_PATH =
  process.env.WDA_DERIVED_DATA_PATH ?? path.join(REPO_ROOT, 'build', 'wda', 'derived');

/** The prebuilt WDA runner `.app` the driver installs+launches (env-overridable). */
export const WDA_PREBUILT_APP_PATH =
  process.env.WDA_PREBUILT_WDA_PATH ??
  path.join(
    WDA_DERIVED_DATA_PATH,
    'Build',
    'Products',
    'Debug-iphonesimulator',
    'WebDriverAgentRunner-Runner.app'
  );

/**
 * Locate the `appium-webdriveragent` package the XCUITest driver actually loads, so the WDA we
 * build matches the one the driver expects at runtime (pnpm may keep several versions on disk).
 */
function resolveWdaProject(): string {
  const driverPkg = require.resolve('appium-xcuitest-driver/package.json', {
    paths: [REPO_ROOT],
  });
  const wdaPkg = require.resolve('appium-webdriveragent/package.json', {
    paths: [path.dirname(driverPkg)],
  });
  const project = path.join(path.dirname(wdaPkg), 'WebDriverAgent.xcodeproj');
  if (!existsSync(project)) {
    throw new Error(`Could not find WebDriverAgent.xcodeproj at ${project}`);
  }
  return project;
}

/** Build the WDA runner into WDA_DERIVED_DATA_PATH. */
export function buildWda(options?: { force?: boolean }): string {
  if (!options?.force && existsSync(WDA_PREBUILT_APP_PATH)) {
    console.log(`WDA runner already built: ${WDA_PREBUILT_APP_PATH}`);
    return WDA_PREBUILT_APP_PATH;
  }

  const project = resolveWdaProject();
  console.log(`Building WebDriverAgent (one-off) -> ${WDA_DERIVED_DATA_PATH}`);
  if (BUILD_LOCK_CMD) {
    console.log(`Serialising the build behind: ${BUILD_LOCK_CMD}`);
  }
  // ~6,700 lines of xcodebuild output, collapsed on CI so it doesn't bury the run that follows.
  // Grouped even on failure (withLogGroup closes in a finally) — an unclosed group would swallow
  // every later line into it.
  withLogGroup('Building WebDriverAgent', () =>
    // build-for-testing produces the *-Runner.app without needing code signing on the simulator SDK.
    execSync(
      [
        ...(BUILD_LOCK_CMD ? [BUILD_LOCK_CMD] : []),
        'xcodebuild build-for-testing',
        `-project "${project}"`,
        '-scheme WebDriverAgentRunner',
        `-destination 'generic/platform=iOS Simulator'`,
        `-derivedDataPath "${WDA_DERIVED_DATA_PATH}"`,
        'CODE_SIGNING_ALLOWED=NO',
      ].join(' '),
      { stdio: 'inherit' }
    )
  );

  if (!existsSync(WDA_PREBUILT_APP_PATH)) {
    throw new Error(
      `WDA build reported success but the runner app is missing at ${WDA_PREBUILT_APP_PATH}`
    );
  }
  console.log(`✓ WDA runner ready: ${WDA_PREBUILT_APP_PATH}`);
  return WDA_PREBUILT_APP_PATH;
}

/** Build WDA only if it isn't already present. Returns the prebuilt runner path. */
export function ensureWdaBuilt(): string {
  return buildWda({ force: false });
}

// CLI entry (only when invoked directly, e.g. `pnpm build-wda`).
if (require.main === module) {
  try {
    buildWda({ force: process.argv.includes('--force') });
  } catch (error) {
    console.error('\n✗ Failed to build WebDriverAgent');
    console.error(error);
    process.exit(1);
  }
}
