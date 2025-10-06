import { AppiumXCUITestCapabilities } from '@wdio/types/build/Capabilities';
import { W3CCapabilities } from '@wdio/types/build/Capabilities';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

import { IntRange } from '../../../types/RangeType';

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
  const jsonPath = 'ci-simulators.json';

  // Load from .env variables
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
      if (!udid) return null; // No need for all 12 sim variables to be set
      return { name: `Sim-${index + 1}`, udid, wdaPort: 1253 + index, index };
    })
    .filter((sim): sim is Simulator => sim !== null);

  // If we have simulators from env, use them (local dev)
  if (simulators.length > 0) {
    console.log(`Using ${simulators.length} simulators from .env file`);
    return simulators.map((sim, newIndex) => ({
      ...sim,
      wdaPort: 1253 + newIndex,
      index: newIndex,
    }));
  }

  // No env simulators - check if we're on CI
  if (process.env.CI === '1') {
    // CI should use JSON
    if (existsSync(jsonPath)) {
      console.log('Using simulators from ios-simulators.json (CI)');
      const sims: Simulator[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      return sims;
    }
    throw new Error('CI mode: ios-simulators.json not found');
  }

  // Local dev with no .env entries
  throw new Error(
    'No iOS simulators found in .env\n' +
      'Run: yarn create-simulators <number>\n' +
      'Example: yarn create-simulators 4'
  );
}
const simulators = loadSimulators();

const capabilities = simulators.map(sim => ({
  ...sharediOSCapabilities,
  'appium:udid': sim.udid,
  'appium:wdaLocalPort': sim.wdaPort,
}));

// Use a constant max that matches the envVars array length for type safety
const _MAX_CAPABILITIES_INDEX = 12 as const;

// For runtime validation, check against actual loaded simulators
export const getMaxCapabilitiesIndex = () => capabilities.length;

// Type is still based on the constant for compile-time safety
export type CapabilitiesIndexType = IntRange<0, typeof _MAX_CAPABILITIES_INDEX>;

export function capabilityIsValid(
  capabilitiesIndex: number
): capabilitiesIndex is CapabilitiesIndexType {
  // Runtime validation against actual loaded capabilities
  if (capabilitiesIndex < 0 || capabilitiesIndex >= capabilities.length) {
    return false;
  }
  return true;
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
