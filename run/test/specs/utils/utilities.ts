import { pick } from 'lodash';
import * as util from 'util';
import moment from 'moment-timezone';

import { exec as execNotPromised } from 'child_process';
import { AccessibilityId } from '../../../types/testing';
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
