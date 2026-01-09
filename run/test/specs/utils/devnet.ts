import { buildStateForTest } from '@session-foundation/qa-seeder';

import type { SupportedPlatformsType } from './open_app';

import { DEVNET_URL } from '../../../constants';
import { AppName } from '../../../types/testing';
import { getAndroidApk } from './binaries';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet
type NetworkType = Parameters<typeof buildStateForTest>[2];

// Using native fetch to check devnet accessibility
async function isDevnetReachable(): Promise<boolean> {
  const isCI = process.env.CI === '1';
  const maxAttempts = isCI ? 3 : 1;
  const timeout = isCI ? 10_000 : 2_000;

  // Check if devnet is available
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (maxAttempts > 1) {
        console.log(`Checking devnet accessibility (attempt ${attempt}/${maxAttempts})...`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(DEVNET_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      console.log(`Internal devnet is accessible (HTTP ${response.status})`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (attempt === maxAttempts) {
        console.log(`Internal devnet is not accessible: ${errorMsg}`);
      } else {
        console.log(`Attempt ${attempt} failed: ${errorMsg}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  return false;
}

function isAutomaticQABuildAndroid(apkPath: string): boolean {
  // Check env var first (for CI), then filename (for local)
  const isAutomaticQA = process.env.IS_AUTOMATIC_QA === 'true' || apkPath.includes('automaticQa');

  console.log(`${isAutomaticQA ? 'Automatic QA/devnet' : 'Regular/mainnet'} build detected`);

  return isAutomaticQA;
}
export async function getNetworkTarget(platform: SupportedPlatformsType): Promise<NetworkType> {
  if (process.env.DETECTED_NETWORK_TARGET) {
    return process.env.DETECTED_NETWORK_TARGET as NetworkType;
  }
  if (platform === 'ios') {
    process.env.DETECTED_NETWORK_TARGET = 'mainnet'; // iOS doesn't supply devnet builds yet
    return 'mainnet';
  }
  if (platform !== 'android') {
    throw new Error('getNetworkTarget: unsupported platform');
  }

  const apkPath = getAndroidApk();
  const isAQA = isAutomaticQABuildAndroid(apkPath);

  // Early exit for non AQA builds - no need to check devnet
  if (!isAQA) {
    process.env.DETECTED_NETWORK_TARGET = 'mainnet';
    console.log('Network target: mainnet');
    return 'mainnet';
  }

  const canAccessDevnet = await isDevnetReachable();
  // If you pass an AQA build in the .env but can't access devnet, tests will fail
  if (isAQA && !canAccessDevnet) {
    throw new Error('Cannot use AQA build without internal network access');
  }
  // If the devnet is available, mainnet is still an option but you *could* switch to an AQA build
  if (!isAQA && canAccessDevnet) {
    console.log('The internal devnet is available, but using regular build');
  }

  const resolvedTarget = isAQA && canAccessDevnet ? DEVNET_URL : 'mainnet';
  process.env.DETECTED_NETWORK_TARGET = resolvedTarget;
  console.log(`Network target: ${resolvedTarget}`);

  return resolvedTarget;
}

export function getAppDisplayName(): AppName {
  const apkPath = getAndroidApk();
  return isAutomaticQABuildAndroid(apkPath) ? 'Session AQA' : 'Session QA';
}
