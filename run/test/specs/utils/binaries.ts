import { existsSync } from 'fs';
import { toNumber } from 'lodash';

function existsOrThrow(path: string, id: string) {
  if (!existsSync(path)) {
    throw new Error(`"${id}" does not exist at: ${path}`);
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

  existsOrThrow(fromEnv, 'adb');

  return fromEnv;
};

export const getEmulatorFullPath = () => {
  if (!process.env.EMULATOR_FULL_PATH) {
    throw new Error('env variable `EMULATOR_FULL_PATH` needs to be set');
  }

  return process.env.EMULATOR_FULL_PATH;
};

export const getAvdManagerFullPath = () => {
  if (!process.env.AVD_MANAGER_FULL_PATH) {
    throw new Error('env variable `AVD_MANAGER_FULL_PATH` needs to be set');
  }

  return process.env.AVD_MANAGER_FULL_PATH;
};

export const getSdkManagerFullPath = () => {
  if (!process.env.SDK_MANAGER_FULL_PATH) {
    throw new Error('env variable `SDK_MANAGER_FULL_PATH` needs to be set');
  }

  return process.env.SDK_MANAGER_FULL_PATH;
};

export const getAndroidSystemImageToUse = () => {
  if (!process.env.ANDROID_SYSTEM_IMAGE) {
    throw new Error('env variable `ANDROID_SYSTEM_IMAGE` needs to be set');
  }

  return process.env.ANDROID_SYSTEM_IMAGE;
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
