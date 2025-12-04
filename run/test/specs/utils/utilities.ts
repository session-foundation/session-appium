import { exec as execNotPromised } from 'child_process';
import * as fs from 'fs';
import { pick } from 'lodash';
import path from 'path';
import * as util from 'util';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { androidAppActivity, androidAppPackage } from './capabilities_android';
import { iOSBundleId } from './capabilities_ios';
import { sleepFor } from './sleep_for';

const exec = util.promisify(execNotPromised);

export async function runScriptAndLog(toRun: string, verbose = false): Promise<string> {
  try {
    if (verbose) {
      console.log('running ', toRun);
    }
    const result = await exec(toRun);

    if (
      result &&
      result.stderr &&
      !result.stderr.startsWith('All files should be loaded. Notifying the device')
    ) {
      if (verbose) {
        console.log(`cmd which failed: "${toRun}"`);
        console.log(`result: "${result.stderr}"`);
      }
      return ''.concat(result.stderr, result.stdout);
    }
    if (verbose) {
      console.log('was run: ', toRun, result);
    }
    return ''.concat(result.stderr, result.stdout);
  } catch (e: any) {
    const cmd = e.cmd;
    if (verbose) {
      console.info(`cmd which failed: "${cmd as string}"`);
      console.info(pick(e, ['stdout', 'stderr']));
    }
    return ''.concat(e.stderr as string, e.stdout as string);
  }
}

export const isDeviceIOS = (device: unknown) => {
  return (device as any).originalCaps.alwaysMatch['appium:platformName']?.toLowerCase() === 'ios';
};

export const isDeviceAndroid = (device: unknown) => !isDeviceIOS(device);

export const isCI = () => {
  return process.env.NODE_CONFIG_ENV === 'ci';
};

// Converts a hexadecimal color string to an RGB object
export function hexToRgbObject(hex: string): { R: number; G: number; B: number } {
  // Parse the hexadecimal string into a decimal number
  // Removes the # prefix if present and converts the remaining string to base-10
  const decimalValue = parseInt(hex.replace('#', ''), 16);
  // Extract the red, green, and blue components using bitwise operations
  return {
    R: (decimalValue >> 16) & 255,
    G: (decimalValue >> 8) & 255,
    B: decimalValue & 255,
  };
}

export function ensureHttpsURL(url: string): string {
  return url.startsWith('https://') ? url : `https://${url}`;
}

export function getDiffDirectory() {
  const diffsDir = path.join('test-results', 'diffs');
  fs.mkdirSync(diffsDir, { recursive: true });
  return diffsDir;
}

export async function assertUrlIsReachable(url: string): Promise<void> {
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Expected status 200 but got ${response.status} for URL: ${url}`);
  }
}

/**
 * Eliminate any potential mismatches by mocking the status bar to always be the same
 */
export async function setConsistentStatusBar(device: DeviceWrapper): Promise<void> {
  if (device.isIOS()) {
    // Time: 4:20, 100% battery, full wifi signal
    await runScriptAndLog(
      `xcrun simctl status_bar ${device.udid} override --time "04:20" --batteryLevel 100 --batteryState charged --wifiBars 3`,
      true
    );
  } else if (device.isAndroid()) {
    // Enable demo mode to set consistent status bar elements
    await runScriptAndLog(`adb -s ${device.udid} shell settings put global sysui_demo_allowed 1`);
    // Dismiss notifications
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false`
    );
    // Time: 4:20
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0420`
    );
    // 100% battery
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false`
    );
    // Full wifi (for some reason shows an ! next to the icon but that's fine)
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4`
    );
  }
}

export async function clearStatusBarOverrides(device: DeviceWrapper): Promise<void> {
  try {
    if (device.isIOS()) {
      await runScriptAndLog(`xcrun simctl status_bar ${device.udid} clear`);
    } else if (device.isAndroid()) {
      await runScriptAndLog(
        `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command exit`
      );
    }
  } catch (error) {
    console.warn('Failed to clear status bar overrides:', error);
    // Don't throw - this is cleanup, shouldn't fail the test
  }
}

export async function forceStopAndRestart(device: DeviceWrapper): Promise<void> {
  if (device.isAndroid()) {
    await runScriptAndLog(`adb -s ${device.udid} shell am force-stop ${androidAppPackage}`, true);
    await sleepFor(1_000);
    await runScriptAndLog(
      `adb -s ${device.udid} shell am start -n ${androidAppPackage}/${androidAppActivity}`,
      true
    );
    await sleepFor(1_000);
  } else if (device.isIOS()) {
    await runScriptAndLog(`xcrun simctl terminate ${device.udid} ${iOSBundleId}`, true);
    await sleepFor(1_000);
    await runScriptAndLog(`xcrun simctl launch ${device.udid} ${iOSBundleId}`, true);
    await sleepFor(1_000);
  }
}
