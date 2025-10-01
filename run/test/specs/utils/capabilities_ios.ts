import { AppiumXCUITestCapabilities } from '@wdio/types/build/Capabilities';
import { W3CCapabilities } from '@wdio/types/build/Capabilities';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

const iosPathPrefix = process.env.IOS_APP_PATH_PREFIX;

if (!iosPathPrefix) {
  throw new Error('IOS_APP_PATH_PREFIX environment variable is not set');
}

const iosAppFullPath = `${iosPathPrefix}`;
console.log(`iOS app full path: ${iosAppFullPath}`);

const sharediOSCapabilities: AppiumXCUITestCapabilities = {
  'appium:app': iosAppFullPath,
  'appium:platformName': 'iOS',
  'appium:platformVersion': '18.3',
  'appium:deviceName': 'iPhone 16 Pro Max',
  'appium:automationName': 'XCUITest',
  'appium:bundleId': 'com.loki-project.loki-messenger',
  'appium:newCommandTimeout': 300000,
  'appium:useNewWDA': false,
  'appium:showXcodeLog': false,
  'appium:autoDismissAlerts': false,
  'appium:reduceMotion': true,
  'appium:processArguments': {
    env: {
      debugDisappearingMessageDurations: 'true',
      communityPollLimit: 5,
    },
  },
} as AppiumXCUITestCapabilities;

type Simulator = {
  name: string;
  udid: string;
  wdaPort: number;
  index: number;
};

function loadSimulators(): Simulator[] {
  const jsonPath = 'ios-simulators.json';

  // Try JSON first (CI with persistent simulators)
  if (existsSync(jsonPath)) {
    console.log('📱 Looking for iOS simulators from ios-simulators.json');
    const content = readFileSync(jsonPath, 'utf-8');
    const sims: Simulator[] = JSON.parse(content);
    console.log(`   Found ${sims.length} simulators`);
    return sims;
  }

  // Fallback to environment variables (local dev)
  console.log('📱 Looking for iOS simulators from environment variables');
  const envVars = [
    'IOS_1_SIMULATOR',
    'IOS_2_SIMULATOR',
    'IOS_3_SIMULATOR',
    'IOS_4_SIMULATOR',
    'IOS_5_SIMULATOR',
    'IOS_6_SIMULATOR',
    'IOS_7_SIMULATOR',
    'IOS_8_SIMULATOR',
    'IOS_9_SIMULATOR',
    'IOS_10_SIMULATOR',
    'IOS_11_SIMULATOR',
    'IOS_12_SIMULATOR',
  ];

  const simulators = envVars
    .map((envVar, index) => {
      const udid = process.env[envVar];
      if (!udid) return null;

      return {
        name: `Sim-${index + 1}`,
        udid,
        wdaPort: 1253 + index,
        index,
      };
    })
    .filter((sim): sim is Simulator => sim !== null);

  // Re-index to be contiguous
  return simulators.map((sim, newIndex) => ({
    ...sim,
    wdaPort: 1253 + newIndex,
    index: newIndex,
  }));
}

const simulators = loadSimulators();

if (simulators.length === 0) {
  throw new Error('No iOS Simulators found.\n' + 'Run: yarn create-simulators <number>');
}

console.log(`✓ Loaded ${simulators.length} iOS simulators`);

const capabilities = simulators.map(sim => ({
  ...sharediOSCapabilities,
  'appium:udid': sim.udid,
  'appium:wdaLocalPort': sim.wdaPort,
}));

export const MAX_CAPABILITIES_INDEX = capabilities.length;
export type CapabilitiesIndexType = number;

export function capabilityIsValid(
  capabilitiesIndex: number
): capabilitiesIndex is CapabilitiesIndexType {
  return capabilitiesIndex >= 0 && capabilitiesIndex < MAX_CAPABILITIES_INDEX;
}

export function getIosCapabilities(capabilitiesIndex: CapabilitiesIndexType): W3CCapabilities {
  if (capabilitiesIndex >= capabilities.length) {
    throw new Error(
      `Asked invalid ios cap index: ${capabilitiesIndex}. Number of iOS capabilities: ${capabilities.length}.`
    );
  }

  const caps = capabilities[capabilitiesIndex];

  return {
    firstMatch: [{}],
    alwaysMatch: { ...caps },
  };
}

export function getCapabilitiesForWorker(workerId: number) {
  const emulator = capabilities[workerId % capabilities.length];
  return {
    ...sharediOSCapabilities,
    'appium:udid': emulator['appium:udid'],
    'appium:wdaLocalPort': emulator['appium:wdaLocalPort'],
  };
}
