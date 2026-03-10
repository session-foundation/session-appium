import { buildStateForTest } from '@session-foundation/qa-seeder';

import type { SupportedPlatformsType } from './open_app';

import { DEVNET_URL } from '../../constants';
import { AppName } from '../../types/testing';
import { getAndroidApk } from './binaries';
import { sleepFor } from './sleep_for';

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
        await sleepFor(attempt * 1000);
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

function isAutomaticQABuildIOS(): boolean {
  const isAutomaticQA = process.env.IS_AUTOMATIC_QA === 'true';

  console.log(`${isAutomaticQA ? 'Automatic QA/devnet' : 'Regular/mainnet'} build detected`);

  return isAutomaticQA;
}

export async function getNetworkTarget(platform: SupportedPlatformsType): Promise<NetworkType> {
  if (process.env.DETECTED_NETWORK_TARGET) {
    return process.env.DETECTED_NETWORK_TARGET as NetworkType;
  }
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('getNetworkTarget: unsupported platform');
  }

  const isAQA =
    platform === 'ios' ? isAutomaticQABuildIOS() : isAutomaticQABuildAndroid(getAndroidApk());

  // Early exit for non AQA builds - no need to check devnet
  if (!isAQA) {
    process.env.DETECTED_NETWORK_TARGET = 'mainnet';
    console.log('Network target: mainnet');
    return 'mainnet';
  }

  // In CI the workflow already verified devnet reachability before setting IS_AUTOMATIC_QA.
  // Skip the check here: Node.js can't resolve .local mDNS hostnames (unlike curl/bash).
  if (process.env.CI !== '1') {
    const canAccessDevnet = await isDevnetReachable();
    if (!canAccessDevnet) {
      throw new Error('Cannot use AQA build without internal network access');
    }
  }

  process.env.DETECTED_NETWORK_TARGET = DEVNET_URL;
  console.log(`Network target: ${DEVNET_URL}`);

  return DEVNET_URL;
}

export function getAppDisplayName(): AppName {
  const apkPath = getAndroidApk();
  return isAutomaticQABuildAndroid(apkPath) ? 'Session AQA' : 'Session QA';
}
