import { W3CUiautomator2DriverCaps } from 'appium-uiautomator2-driver/build/lib/types';
import dotenv from 'dotenv';
import { isString } from 'lodash';

import { getAndroidApk } from './binaries';
import { buildAndroidLaunchExtras } from './devnet_android';
dotenv.config({ quiet: true });
// Access the environment variable

// Concatenate the environment variable with the fixed part of the path
const androidAppFullPath = getAndroidApk();

export const androidAppPackage = 'network.loki.messenger';
export const androidAppActivity = 'network.loki.messenger.RoutingActivity';

console.log(`Android app full path: ${androidAppFullPath}`);

const sharedCapabilities: W3CUiautomator2DriverCaps['alwaysMatch'] = {
  'appium:app': androidAppFullPath,
  platformName: 'Android',
  'appium:platformVersion': '14',
  'appium:appPackage': androidAppPackage,
  'appium:appActivity': androidAppActivity,
  'appium:automationName': 'UiAutomator2',
  'appium:newCommandTimeout': 300000,
  'appium:eventTimings': false,
  'appium:injectedImageProperties': {},
};

const udids = ['emulator-5554', 'emulator-5556', 'emulator-5558', 'emulator-5560'];

const emulatorCapabilities: W3CUiautomator2DriverCaps['alwaysMatch'][] = udids.map(udid => ({
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

/** Number of emulators this harness knows about (the Android capability pool size). */
export const getAndroidPoolSize = () => emulatorCapabilities.length;

/**
 * Android counterpart of `capabilityIsValid`. Android used to be validated against the *iOS* pool
 * length, which only ever worked because both pools happen to be 4 entries long.
 *
 * Returns a plain boolean over a plain `number` rather than narrowing to the iOS
 * `CapabilitiesIndexType`: the bound checked here is `emulatorCapabilities.length`, so narrowing to
 * an iOS-derived type asserted something this function never verified. The Android pool is a
 * runtime list (`udids`), so the bound stays a runtime check — the two consumers below share it.
 */
export function androidCapabilityIsValid(capabilitiesIndex: number): boolean {
  return capabilitiesIndex >= 0 && capabilitiesIndex < emulatorCapabilities.length;
}

export function getAndroidCapabilities(capabilitiesIndex: number): W3CUiautomator2DriverCaps {
  const allCaps = getAllCaps();
  if (!androidCapabilityIsValid(capabilitiesIndex)) {
    throw new Error(`Asked invalid android capability index: ${capabilitiesIndex}`);
  }
  const cap = allCaps[capabilitiesIndex];

  // Android's counterpart of the iOS `processArguments.env` launch variables: appended to the
  // `am start` the driver issues, and read by QaLaunchConfig in the app (QA builds only).
  const optionalIntentArguments = buildAndroidLaunchExtras();

  return {
    firstMatch: [{}, {}],
    alwaysMatch: {
      ...cap,
      ...(optionalIntentArguments
        ? { 'appium:optionalIntentArguments': optionalIntentArguments }
        : {}),
    },
  } as W3CUiautomator2DriverCaps;
}
export function getAndroidUdid(udidIndex: number): string {
  const allCaps = getAllCaps();

  if (!androidCapabilityIsValid(udidIndex)) {
    throw new Error(`Asked invalid android udid index: ${udidIndex}`);
  }
  const cap = allCaps[udidIndex];

  const udid = cap['appium:udid'];
  if (isString(udid)) {
    return udid;
  }
  throw new Error('Udid isnt set');
}
