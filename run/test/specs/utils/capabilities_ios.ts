import { AppiumXCUITestCapabilities } from '@wdio/types/build/Capabilities';
import { W3CCapabilities } from '@wdio/types/build/Capabilities';
import dotenv from 'dotenv';
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
  'appium:platformVersion': '17.2',
  'appium:deviceName': 'iPhone 15 Pro Max',
  'appium:automationName': 'XCUITest',
  'appium:bundleId': 'com.loki-project.loki-messenger',
  'appium:newCommandTimeout': 300000,
  'appium:useNewWDA': false,
  'appium:showXcodeLog': false,
  'appium:autoDismissAlerts': false,
  'appium:reduceMotion': true,
  // "appium:isHeadless": true,
} as AppiumXCUITestCapabilities;

const MAX_CAPABILITIES_INDEX = 12;
export type CapabilitiesIndexType = IntRange<0, typeof MAX_CAPABILITIES_INDEX>;

export function capabilityIsValid(
  capabilitiesIndex: number
): capabilitiesIndex is CapabilitiesIndexType {
  if (capabilitiesIndex < 0 || capabilitiesIndex > MAX_CAPABILITIES_INDEX) {
    return false;
  }
  return true;
}

interface CustomW3CCapabilities extends W3CCapabilities {
  'appium:wdaLocalPort': number;
  'appium:udid': string;
}

function getIOSSimulatorUUIDFromEnv(index: CapabilitiesIndexType): string {
  const envVars = [
    'IOS_FIRST_SIMULATOR',
    'IOS_SECOND_SIMULATOR',
    'IOS_THIRD_SIMULATOR',
    'IOS_FOURTH_SIMULATOR',
    'IOS_FIFTH_SIMULATOR',
    'IOS_SIXTH_SIMULATOR',
    'IOS_SEVENTH_SIMULATOR',
    'IOS_EIGHTH_SIMULATOR',
    'IOS_NINTH_SIMULATOR',
    'IOS_TENTH_SIMULATOR',
    'IOS_ELEVENTH_SIMULATOR',
    'IOS_TWELFTH_SIMULATOR',
  ];

  const envVar = envVars[index];
  const uuid = process.env[envVar];

  if (!uuid) {
    throw new Error(`Environment variable ${envVar} is not set`);
  }

  return uuid;
}

const emulatorUUIDs = Array.from({ length: MAX_CAPABILITIES_INDEX }, (_, index) =>
  getIOSSimulatorUUIDFromEnv(index as CapabilitiesIndexType)
);

const capabilities = emulatorUUIDs.map((udid, index) => ({
  ...sharediOSCapabilities,
  'appium:udid': udid,
  'appium:wdaLocalPort': 1253 + index,
}));

export function getIosCapabilities(capabilitiesIndex: CapabilitiesIndexType): W3CCapabilities {
  if (capabilitiesIndex >= capabilities.length) {
    throw new Error(`Asked invalid ios cap index: ${capabilitiesIndex}`);
  }

  const caps = capabilities[capabilitiesIndex];

  return {
    firstMatch: [{}],
    alwaysMatch: { ...caps },
  };
}

export function getCapabilitiesForWorker(workerId: number): CustomW3CCapabilities {
  const emulator = capabilities[workerId % capabilities.length];
  return {
    ...sharediOSCapabilities,
    'appium:udid': emulator['appium:udid'],
    'appium:wdaLocalPort': emulator['appium:wdaLocalPort'],
  } as CustomW3CCapabilities;
}
