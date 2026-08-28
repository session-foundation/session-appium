import { exec as execNotPromised } from 'child_process';
import * as fs from 'fs';
import { pick } from 'lodash';
import path from 'path';
import * as util from 'util';

import { sleepFor } from '../../shared/promise_utils';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { PlusButton } from '../locators/home';
import { getAdbFullPath } from './binaries';
import { androidAppActivity, androidAppPackage } from './capabilities_android';
import { iOSBundleId } from './capabilities_ios';

const exec = util.promisify(execNotPromised);

/**
 * Run a shell command, tolerating failure.
 *
 * Success is the EXIT CODE and nothing else. Plenty of the tools driven here write to stderr on a
 * perfectly good run — `adb push` reports its throughput there and exits 0 — so treating stderr as
 * failure reports commands that worked. That is worse than saying nothing: three false "cmd which
 * failed" lines in a green run teach a reader to skip the string, which is how a real one gets past.
 *
 * Failure is swallowed and returned as output, so **the caller cannot tell**. That is right only where
 * a command is genuinely optional. Where a failed command corrupts the test rather than degrading it —
 * anything that puts a fixture on the device — use {@link runScriptOrThrow}.
 */
export async function runScriptAndLog(toRun: string, verbose = false): Promise<string> {
  try {
    if (verbose) {
      console.log('running ', toRun);
    }
    const result = await exec(toRun);
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

/**
 * Run a shell command, throwing if it fails.
 *
 * For the commands a test's correctness rests on. A silently failed `adb push` leaves the previous
 * run's media on the device, so the spec goes green against a file its own setup did not put there —
 * and on a device that never had it, fails somewhere unrelated with no mention of the push.
 */
export async function runScriptOrThrow(toRun: string, verbose = false): Promise<string> {
  try {
    if (verbose) {
      console.log('running ', toRun);
    }
    const result = await exec(toRun);
    return ''.concat(result.stderr, result.stdout);
  } catch (e: any) {
    const details = pick(e, ['stdout', 'stderr', 'code']);
    throw new Error(`Command failed: "${toRun}"\n${JSON.stringify(details, null, 2)}`);
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

// Shared cross-platform helper (mobile + desktop) lives in run/shared/url.ts.
export { assertUrlIsReachable } from '../../shared/url';

/**
 * Eliminate any potential mismatches by mocking the status bar to always be the same
 */
export async function setConsistentStatusBar(device: DeviceWrapper): Promise<void> {
  if (device.isIOS()) {
    // Time: 4:20, full wifi signal
    // Manipulating the battery status is not always reliable (charged/charging can flicker)
    await runScriptAndLog(
      `xcrun simctl status_bar ${device.udid} override --time "04:20" --wifiBars 3`,
      true
    );
  } else if (device.isAndroid()) {
    // Enable demo mode to set consistent status bar elements
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell settings put global sysui_demo_allowed 1`
    );
    // Dismiss notifications
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false`
    );
    // Time: 4:20
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0420`
    );
    // 100% battery
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false`
    );
    // Full wifi (for some reason shows an ! next to the icon but that's fine)
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4`
    );
  }
}

export async function clearStatusBarOverrides(device: DeviceWrapper): Promise<void> {
  try {
    if (device.isIOS()) {
      await runScriptAndLog(`xcrun simctl status_bar ${device.udid} clear`);
    } else if (device.isAndroid()) {
      await runScriptAndLog(
        `${getAdbFullPath()} -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command exit`
      );
    }
  } catch (error) {
    console.warn('Failed to clear status bar overrides:', error);
    // Don't throw - this is cleanup, shouldn't fail the test
  }
}

export async function forceStopAndRestart(
  device: DeviceWrapper,
  waitForRestart: boolean = true
): Promise<void> {
  if (device.isAndroid()) {
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am force-stop ${androidAppPackage}`,
      true
    );
    await sleepFor(1_000);
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell am start -n ${androidAppPackage}/${androidAppActivity}`,
      true
    );
  } else if (device.isIOS()) {
    await runScriptAndLog(`xcrun simctl terminate ${device.udid} ${iOSBundleId}`, true);
    await sleepFor(1_000);
    await runScriptAndLog(`xcrun simctl launch ${device.udid} ${iOSBundleId}`, true);
  }
  // The post-launch settle is covered by the PlusButton wait below (when waitForRestart is set),
  // which polls — no fixed sleep needed.
  // Ensure we're on the home screen again if desired
  if (waitForRestart) {
    await device.waitForTextElementToBePresent(new PlusButton(device));
  }
}

export { verify } from '../../shared/verify';
