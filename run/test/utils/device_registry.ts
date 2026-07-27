import type { TestInfo } from '@playwright/test';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { getAdbFullPath } from './binaries';
import { androidAppPackage } from './capabilities_android';
import { runScriptAndLog } from './utilities';

export type LogContext = {
  startMs: number; // epoch ms — iOS: compared against log file mtime; Android: derived to epoch seconds for adb -T
  pid?: string | null; // Android only — null if pidof returned nothing (app not yet running or already dead)
};

export type DeviceContext = {
  // Devices of ANY platform registered for this test. Log/screenshot capture derives
  // the platform per device (device.isAndroid()/isIOS()), so one test can hold devices
  // of different platforms.
  devices: DeviceWrapper[];
  logCtxByUdid?: Map<string, LogContext>;
};

export const deviceRegistry = new Map<string, DeviceContext>();

export function registryKey(testInfo: TestInfo): string {
  return `${testInfo.testId}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}`;
}

// Async because Android registration fetches per-device PID for scoped logcat on failure.
// Registering again for the same test MERGES the new devices into the existing entry, so a
// single test can open devices of different platforms (e.g. an Android device + iOS device)
// across multiple opener calls. The platform is derived per device rather than per call.
export async function registerDevicesForTest(testInfo: TestInfo, devices: DeviceWrapper[]) {
  const key = registryKey(testInfo);
  const startMs = Date.now();

  // Resolve log contexts for the NEW devices into a local map first (this is the only
  // awaited step — Android needs its PID for scoped logcat; iOS only needs a timestamp).
  const newLogCtx = new Map<string, LogContext>();
  await Promise.all(
    devices.map(async device => {
      if (device.isAndroid()) {
        const pidOutput = await runScriptAndLog(
          `${getAdbFullPath()} -s ${device.udid} shell pidof ${androidAppPackage}`
        );
        const pid = pidOutput.trim() || null;
        newLogCtx.set(device.udid, { startMs, pid });
      } else {
        newLogCtx.set(device.udid, { startMs });
      }
    })
  );

  // Read-merge-write with NO await in between so concurrent registrations for the same
  // test key (the merge behavior is designed for multi-opener calls) can't lose-update:
  // each call reads the freshest entry here and appends its devices atomically.
  const existing = deviceRegistry.get(key);
  const logCtxByUdid = existing?.logCtxByUdid ?? new Map<string, LogContext>();
  newLogCtx.forEach((ctx, udid) => logCtxByUdid.set(udid, ctx));

  deviceRegistry.set(key, {
    devices: existing ? [...existing.devices, ...devices] : devices,
    logCtxByUdid,
  });
}

export function unregisterDevicesForTest(testInfo: TestInfo) {
  deviceRegistry.delete(registryKey(testInfo));
}
