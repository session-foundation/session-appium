import type { TestInfo } from '@playwright/test';

import type { SupportedPlatformsType } from './open_app';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { getAdbFullPath } from './binaries';
import { androidAppPackage } from './capabilities_android';
import { runScriptAndLog } from './utilities';

export type LogContext = {
  startMs: number; // epoch ms — iOS: compared against log file mtime; Android: derived to epoch seconds for adb -T
  pid?: string | null; // Android only — null if pidof returned nothing (app not yet running or already dead)
};

export type DeviceContext = {
  devices: DeviceWrapper[];
  platform: SupportedPlatformsType;
  logCtxByUdid?: Map<string, LogContext>;
};

export const deviceRegistry = new Map<string, DeviceContext>();

export function registryKey(testInfo: TestInfo): string {
  return `${testInfo.testId}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
}

// Async because Android registration fetches per-device PID for scoped logcat on failure.
export async function registerDevicesForTest(
  testInfo: TestInfo,
  devices: DeviceWrapper[],
  platform: SupportedPlatformsType
) {
  const key = registryKey(testInfo);
  // Throw if registry already has an entry — indicates a previous test didn't unregister properly
  if (deviceRegistry.has(key)) {
    throw new Error(`Device registry already contains entry for test "${testInfo.title}"`);
  }

  const startMs = Date.now();
  const logCtxByUdid = new Map<string, LogContext>();

  if (platform === 'android') {
    await Promise.all(
      devices.map(async device => {
        const pidOutput = await runScriptAndLog(
          `${getAdbFullPath()} -s ${device.udid} shell pidof ${androidAppPackage}`
        );
        const pid = pidOutput.trim() || null;
        logCtxByUdid.set(device.udid, { startMs, pid });
      })
    );
  } else if (platform === 'ios') {
    for (const device of devices) {
      logCtxByUdid.set(device.udid, { startMs });
    }
  }

  deviceRegistry.set(key, { devices, platform, logCtxByUdid });
}

export function unregisterDevicesForTest(testInfo: TestInfo) {
  deviceRegistry.delete(registryKey(testInfo));
}
