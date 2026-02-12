import { AppiumXCUITestCapabilities } from '@wdio/types/build/Capabilities';
import { W3CXCUITestDriverCaps } from 'appium-xcuitest-driver/build/lib/driver';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

import { IntRange } from '../../types/RangeType';

dotenv.config({ quiet: true });

export type IOSTestContext = {
  customInstallTime?: string;
  sessionProEnabled?: string;
};


const iosPathPrefix = process.env.IOS_APP_PATH_PREFIX;

export const iOSBundleId = 'com.loki-project.loki-messenger';

if (!iosPathPrefix) {
  throw new Error('IOS_APP_PATH_PREFIX environment variable is not set');
}

const iosAppFullPath = `${iosPathPrefix}`;
console.log(`iOS app full path: ${iosAppFullPath}`);

const sharediOSCapabilities: AppiumXCUITestCapabilities = {
  'appium:app': iosAppFullPath,
  'appium:platformName': 'iOS',
  'appium:platformVersion': '26.2',
  'appium:deviceName': 'iPhone 17',
  'appium:automationName': 'XCUITest',
  'appium:bundleId': iOSBundleId,
  'appium:newCommandTimeout': 600000,
  'appium:useNewWDA': false,
  'appium:showXcodeLog': false,
  'appium:autoDismissAlerts': false,
  'appium:reduceMotion': true,
  'appium:processArguments': {
    env: {
      debugDisappearingMessageDurations: 'true',
      communityPollLimit: '3',
      animationsEnabled: 'false',
    },
  },
} as AppiumXCUITestCapabilities;

export type Simulator = {
  name: string;
  udid: string;
  wdaPort: number;
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
      return { name: `Sim-${index + 1}`, udid, wdaPort: 1253 + index };
    })
    .filter((sim): sim is Simulator => sim !== null);

  // If we have simulators from env, use them (local dev)
  if (simulators.length > 0) {
    console.log(`Using ${simulators.length} simulators from .env file`);
    return simulators;
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
      'Run: pnpm create-simulators <number>\n' +
      'Example: pnpm create-simulators 4'
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

export function getIosCapabilities(
  capabilitiesIndex: CapabilitiesIndexType,
  customCaps?: IOSTestContext
): W3CXCUITestDriverCaps {
  if (capabilitiesIndex >= capabilities.length) {
    throw new Error(
      `Asked invalid ios cap index: ${capabilitiesIndex}. Number of iOS capabilities: ${capabilities.length}.`
    );
  }

  // Deep clone the capabilities object so we never mutate the shared global template.
  // Appium caps contain nested objects, so shallow clone ({...obj}) is not safe.
  const caps = structuredClone(capabilities[capabilitiesIndex]);

  // Extract the existing env block inside appium:processArguments.
  const baseEnv =
    (caps['appium:processArguments'] as { env?: Record<string, string> } | undefined)?.env ?? {};

  // Build custom env entries from per-test overrides
  const customEnv: Record<string, string> = {};
  if (customCaps?.customInstallTime) {
    customEnv.customFirstInstallDateTime = customCaps.customInstallTime;
  }
  if (customCaps?.sessionProEnabled) {
    customEnv.sessionPro = customCaps.sessionProEnabled;
  }

  // Rebuild the processArguments block with merged env vars
  caps['appium:processArguments'] = {
    env: { ...baseEnv, ...customEnv },
  };

  return {
    firstMatch: [{}],
    alwaysMatch: caps,
  } as W3CXCUITestDriverCaps;
}

export function getCapabilitiesForWorker(workerId: number) {
  const emulator = capabilities[workerId % capabilities.length];
  return {
    ...sharediOSCapabilities,
    'appium:udid': emulator['appium:udid'],
    'appium:wdaLocalPort': emulator['appium:wdaLocalPort'],
  };
}
