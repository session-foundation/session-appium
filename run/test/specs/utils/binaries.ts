import { existsSync, lstatSync } from 'fs';
import { toNumber } from 'lodash';
import * as path from 'path';

function existsAndFileOrThrow(path: string, id: string) {
  if (!existsSync(path) || !lstatSync(path).isFile()) {
    throw new Error(`"${id}" not found or not a file at: ${path}`);
  }
}

const getAndroidSdkRoot = () => {
  const sdkRoot = process.env.ANDROID_SDK_ROOT;
  if (!sdkRoot) {
    throw new Error('env variable `ANDROID_SDK_ROOT` needs to be set');
  }
  return sdkRoot;
};

export function getAndroidApk() {
  const fromEnv = process.env.ANDROID_APK;
  if (!fromEnv) {
    throw new Error('env variable `ANDROID_APK` needs to be set');
  }

  return fromEnv;
}

export const getAdbFullPath = () => {
  const sdkRoot = getAndroidSdkRoot();
  const adbPath = path.join(sdkRoot, 'platform-tools', 'adb');
  existsAndFileOrThrow(adbPath, 'adb');
  return adbPath;
};

export const getEmulatorFullPath = () => {
  const sdkRoot = getAndroidSdkRoot();
  const emulatorPath = path.join(sdkRoot, 'emulator', 'emulator');
  existsAndFileOrThrow(emulatorPath, 'emulator');
  return emulatorPath;
};

export const getAvdManagerFullPath = () => {
  const sdkRoot = getAndroidSdkRoot();
  // Try multiple possible locations
  const possiblePaths = [
    path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
    path.join(sdkRoot, 'cmdline-tools', 'tools', 'bin', 'avdmanager'),
    path.join(sdkRoot, 'tools', 'bin', 'avdmanager'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path) && lstatSync(path).isFile()) {
      return path;
    }
  }

  throw new Error(`avdmanager not found in any expected location under ${sdkRoot}`);
};

export const getSdkManagerFullPath = () => {
  const sdkRoot = getAndroidSdkRoot();
  // Try multiple possible locations
  const possiblePaths = [
    path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager'),
    path.join(sdkRoot, 'cmdline-tools', 'tools', 'bin', 'sdkmanager'),
    path.join(sdkRoot, 'tools', 'bin', 'sdkmanager'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path) && lstatSync(path).isFile()) {
      return path;
    }
  }

  throw new Error(`sdkmanager not found in any expected location under ${sdkRoot}`);
};

export const getAndroidSystemImageToUse = () => {
  const fromEnv = process.env.ANDROID_SYSTEM_IMAGE;

  if (!fromEnv) {
    throw new Error('env variable `ANDROID_SYSTEM_IMAGE` needs to be set');
  }

  return fromEnv;
};

export const getRetriesCount = () => {
  const asNumber = toNumber(process.env.PLAYWRIGHT_RETRIES_COUNT);
  return isFinite(asNumber) ? asNumber : 0;
};

export const getRepeatEachCount = () => {
  const asNumber = toNumber(process.env.PLAYWRIGHT_REPEAT_COUNT);
  return isFinite(asNumber) ? asNumber : 0;
};

export const getWorkersCount = () => {
  const asNumber = toNumber(process.env.PLAYWRIGHT_WORKERS_COUNT);
  return isFinite(asNumber) ? asNumber : 1;
};

export const getDevicesPerTestCount = () => {
  const asNumber = toNumber(process.env.DEVICES_PER_TEST_COUNT);
  return isFinite(asNumber) ? asNumber : 4;
};
