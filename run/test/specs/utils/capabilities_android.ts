import {
  AppiumAndroidCapabilities,
  AppiumCapabilities,
  W3CCapabilities,
} from '@wdio/types/build/Capabilities';
import dotenv from 'dotenv';
import { isString } from 'lodash';
import { CapabilitiesIndexType } from './capabilities_ios';
import { getAndroidApk } from './binaries';
dotenv.config();
// Access the environment variable

// Concatenate the environment variable with the fixed part of the path
const androidAppFullPath = getAndroidApk();

console.log(`Android app full path: ${androidAppFullPath}`);

// const androidAppFullPath = `/Users/emilyburton/Downloads/session-android-20240531T000357Z-b544961d2-universal/session-1.18.4-universal.apk`;

const sharedCapabilities: AppiumAndroidCapabilities & AppiumCapabilities = {
  'appium:app': androidAppFullPath,
  'appium:platformName': 'Android',
  'appium:platformVersion': '14',
  'appium:appPackage': 'network.loki.messenger',
  'appium:appActivity': 'network.loki.messenger.RoutingActivity',
  'appium:automationName': 'UiAutomator2',
  'appium:newCommandTimeout': 300000,
  'appium:eventTimings': false,
};

const emulator1Udid = 'emulator-5554';
const emulator2Udid = 'emulator-5556';
const emulator3Udid = 'emulator-5558';
const emulator4Udid = 'emulator-5560';
const emulator5Udid = 'emulator-5562';
const emulator6Udid = 'emulator-5564';
const emulator7Udid = 'emulator-5566';
const emulator8Udid = 'emulator-5568';

const udids = [
  emulator1Udid,
  emulator2Udid,
  emulator3Udid,
  emulator4Udid,
  emulator5Udid,
  emulator6Udid,
  emulator7Udid,
  emulator8Udid,
];

const emulatorCapabilities: AppiumCapabilities[] = udids.map(udid => ({
  ...sharedCapabilities,
  'appium:udid': udid,
}));

// Access individual capabilities like this
const emulatorCapabilities1 = emulatorCapabilities[0];
const emulatorCapabilities2 = emulatorCapabilities[1];
const emulatorCapabilities3 = emulatorCapabilities[2];
const emulatorCapabilities4 = emulatorCapabilities[3];
const emulatorCapabilities5 = emulatorCapabilities[4];
const emulatorCapabilities6 = emulatorCapabilities[5];
const emulatorCapabilities7 = emulatorCapabilities[6];
const emulatorCapabilities8 = emulatorCapabilities[7];

export const androidCapabilities = {
  sharedCapabilities,
  androidAppFullPath,
};

function getAllCaps() {
  const emulatorCaps = [
    emulatorCapabilities1,
    emulatorCapabilities2,
    emulatorCapabilities3,
    emulatorCapabilities4,
    emulatorCapabilities5,
    emulatorCapabilities6,
    emulatorCapabilities7,
    emulatorCapabilities8,
  ];
  return emulatorCaps;
}

export function getAndroidCapabilities(capabilitiesIndex: CapabilitiesIndexType): W3CCapabilities {
  const allCaps = getAllCaps();
  if (capabilitiesIndex >= allCaps.length) {
    throw new Error(`Asked invalid android capability index: ${capabilitiesIndex}`);
  }
  const cap = allCaps[capabilitiesIndex];
  return {
    firstMatch: [{}, {}],
    alwaysMatch: { ...cap },
  };
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
