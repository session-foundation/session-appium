import { AppiumAndroidCapabilities, AppiumCapabilities } from '@wdio/types/build/Capabilities';
import { W3CUiautomator2DriverCaps } from 'appium-uiautomator2-driver/build/lib/types';
import dotenv from 'dotenv';
import { isString } from 'lodash';

import { getAndroidApk } from './binaries';
import { CapabilitiesIndexType } from './capabilities_ios';
dotenv.config({ quiet: true });
// Access the environment variable

// Concatenate the environment variable with the fixed part of the path
const androidAppFullPath = getAndroidApk();

export const androidAppPackage = 'network.loki.messenger';
export const androidAppActivity = 'network.loki.messenger.RoutingActivity';

console.log(`Android app full path: ${androidAppFullPath}`);

const sharedCapabilities: AppiumAndroidCapabilities & AppiumCapabilities = {
  'appium:app': androidAppFullPath,
  'appium:platformName': 'Android',
  'appium:platformVersion': '14',
  'appium:appPackage': androidAppPackage,
  'appium:appActivity': androidAppActivity,
  'appium:automationName': 'UiAutomator2',
  'appium:newCommandTimeout': 300000,
  'appium:eventTimings': false,
};

const udids = ['emulator-5554', 'emulator-5556', 'emulator-5558', 'emulator-5560'];

const emulatorCapabilities: AppiumCapabilities[] = udids.map(udid => ({
  ...sharedCapabilities,
  'appium:udid': udid,
}));

export const androidCapabilities = {
  sharedCapabilities,
  androidAppFullPath,
};

function getAllCaps() {
  return emulatorCapabilities;
}

export function getAndroidCapabilities(
  capabilitiesIndex: CapabilitiesIndexType
): W3CUiautomator2DriverCaps {
  const allCaps = getAllCaps();
  if (capabilitiesIndex >= allCaps.length) {
    throw new Error(`Asked invalid android capability index: ${capabilitiesIndex}`);
  }
  const cap = allCaps[capabilitiesIndex];
  return {
    firstMatch: [{}, {}],
    alwaysMatch: { ...cap },
  } as W3CUiautomator2DriverCaps;
}
export function getAndroidUdid(udidIndex: CapabilitiesIndexType): string {
  const allCaps = getAllCaps();

  if (udidIndex >= allCaps.length) {
    throw new Error(`Asked invalid android udid index: ${udidIndex}`);
  }
  const cap = allCaps[udidIndex];

  const udid = cap['appium:udid'];
  if (isString(udid)) {
    return udid;
  }
  throw new Error('Udid isnt set');
}
