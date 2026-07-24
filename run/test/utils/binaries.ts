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

export const getRetriesCount = () => {
  const asNumber = toNumber(process.env.PLAYWRIGHT_RETRIES_COUNT);
  return isFinite(asNumber) ? asNumber : 0;
};

export const getRepeatEachCount = () => {
  const asNumber = toNumber(process.env.PLAYWRIGHT_REPEAT_COUNT);
  return isFinite(asNumber) ? asNumber : 0;
};

export type WorkersPlatform = 'android' | 'desktop' | 'ios';

// Workers are configured per-platform so each platform can be tuned independently
// (e.g. iOS is capped by the self-hosted runner, Android by the emulator count).
export const getWorkersCount = (platform: WorkersPlatform | undefined) => {
  const perPlatform: Record<WorkersPlatform, string | undefined> = {
    android: process.env.PLAYWRIGHT_WORKERS_COUNT_ANDROID,
    ios: process.env.PLAYWRIGHT_WORKERS_COUNT_IOS,
    desktop: process.env.PLAYWRIGHT_WORKERS_COUNT_DESKTOP,
  };
  const asNumber = toNumber(platform ? perPlatform[platform] : undefined);
  return isFinite(asNumber) ? asNumber : 1;
};

export const getDevicesPerTestCount = () => {
  const asNumber = toNumber(process.env.DEVICES_PER_TEST_COUNT);
  return isFinite(asNumber) ? asNumber : 4;
};
