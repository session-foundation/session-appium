import { existsSync, lstatSync } from 'fs';
import { toNumber } from 'lodash';

function existsAndFileOrThrow(path: string, id: string) {
  if (!existsSync(path) || !lstatSync(path).isFile()) {
    throw new Error(`"${id}" does not exist at: ${path} or not a path`);
  }
}

export function getAndroidApk() {
  const fromEnv = process.env.ANDROID_APK;
  if (!fromEnv) {
    throw new Error('env variable `ANDROID_APK` needs to be set');
  }

  return fromEnv;
}

export const getAdbFullPath = () => {
  const fromEnv = process.env.APPIUM_ADB_FULL_PATH;
  if (!fromEnv) {
    throw new Error('env variable `APPIUM_ADB_FULL_PATH` needs to be set');
  }

  existsAndFileOrThrow(fromEnv, 'adb');

  return fromEnv;
};

export const getEmulatorFullPath = () => {
  const fromEnv = process.env.EMULATOR_FULL_PATH;

  if (!fromEnv) {
    throw new Error('env variable `EMULATOR_FULL_PATH` needs to be set');
  }
  existsAndFileOrThrow(fromEnv, 'EMULATOR_FULL_PATH');

  return fromEnv;
};

export const getAvdManagerFullPath = () => {
  const fromEnv = process.env.AVD_MANAGER_FULL_PATH;

  if (!fromEnv) {
    throw new Error('env variable `AVD_MANAGER_FULL_PATH` needs to be set');
  }
  existsAndFileOrThrow(fromEnv, 'AVD_MANAGER_FULL_PATH');

  return fromEnv;
};

export const getSdkManagerFullPath = () => {
  const fromEnv = process.env.SDK_MANAGER_FULL_PATH;

  if (!fromEnv) {
    throw new Error('env variable `SDK_MANAGER_FULL_PATH` needs to be set');
  }

  existsAndFileOrThrow(fromEnv, 'SDK_MANAGER_FULL_PATH');

  return fromEnv;
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