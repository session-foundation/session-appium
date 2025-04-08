import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { getChunkedSimulators } from './ios_shared';

const BUILD_WDA_CHUNK = 4;

// const SIMULATOR_DEVICE = 'iPhone 15 Pro Max';
const SIMULATOR_OS = '18.3';

const VERBOSE_XCODE_BUILD = false;


function buildWdaRunnerThroughXcodeFor(udid: string, iphoneOsTarget: string, verbose: boolean) {
  try {
    console.log(`build wda runner for simulator ${udid}: ${iphoneOsTarget}`);
    rmSync(`/tmp/wda/${udid}`, { force: true, recursive: true });
    execSync(
      `xcodebuild build-for-testing -project ./node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -derivedDataPath /tmp/wda/${udid} -destination id=${udid} IPHONEOS_DEPLOYMENT_TARGET=${iphoneOsTarget} GCC_TREAT_WARNINGS_AS_ERRORS=0 COMPILER_INDEX_STORE_ENABLE=NO ONLY_ACTIVE_ARCH=YES`,
      { stdio: verbose ? 'inherit' : 'ignore' }
    );
  } catch (error: any) {
    console.error(`Error: failed to build for ${udid}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }
}

function buildWdaRunnerForAllSimulators(verbose: boolean) {
  const chunks = getChunkedSimulators(BUILD_WDA_CHUNK);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[0];

    for (const sim of chunk) {
      // TODO this not async, not all of those are running sequentially.
      // The mac runner can run more than one, so we should use it's full power.
      // However, the script is called as is by the CI, so we also need to make sure the call made
      // by the CI is waiting for that promise to be resolved (or the event loop to be empty)
      buildWdaRunnerThroughXcodeFor(sim.udid, SIMULATOR_OS, verbose);
    }
  }
}

buildWdaRunnerForAllSimulators(VERBOSE_XCODE_BUILD);
