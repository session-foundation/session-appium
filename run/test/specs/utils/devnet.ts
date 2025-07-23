import { buildStateForTest } from '@session-foundation/qa-seeder';
import { execSync } from 'child_process';

import type { SupportedPlatformsType } from './open_app';

import { DEVNET_URL } from '../../../constants';
import { AppName } from '../../../types/testing';
import { getAndroidApk } from './binaries';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet

type NetworkType = Parameters<typeof buildStateForTest>[2];

let DETECTED_NETWORK_TARGET: NetworkType | null = null;

// Check if tests can reach the internal devnet
export function canReachDevnet(): boolean {
  try {
    // Check if devnet is available using curl
    const httpCode = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 ${DEVNET_URL}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    // 000 means connection failed, anything else means devnet is available
    if (httpCode !== '000') {
      console.log(`Internal devnet is accessible (HTTP ${httpCode})`);
      return true;
    }
    console.log('Internal devnet is not accessible');
    return false;
  } catch {
    console.log('Internal devnet is not accessible');
    return false;
  }
}

export function isAutomaticQABuildAndroid(apkPath: string): boolean {
  // Check env var first (for CI), then filename (for local)
  const isAutomaticQA = process.env.IS_AUTOMATIC_QA === 'true' || apkPath.includes('automaticQa');

  console.log(`${isAutomaticQA ? 'Automatic QA/devnet' : 'Regular/mainnet'} build detected`);

  return isAutomaticQA;
}
// Determine the network used by the qa-seeder
export function getNetworkTarget(platform: SupportedPlatformsType): NetworkType {
  if (!DETECTED_NETWORK_TARGET) {
    if (platform === 'ios') {
      DETECTED_NETWORK_TARGET = 'mainnet'; // iOS doesn't supply devnet builds yet
    } else {
      const apkPath = getAndroidApk();
      const isAQA = isAutomaticQABuildAndroid(apkPath);
      const canAccessDevnet = canReachDevnet();

      // If you pass an AQA build in the .env but can't access devnet, tests will fail
      if (isAQA && !canAccessDevnet) {
        throw new Error('Cannot use AQA build without internal network access');
      }

      // If the devnet is available, mainnet is still an option but you *could* switch to an AQA build
      if (!isAQA && canAccessDevnet) {
        console.warn('The internal devnet is available, but using regular build');
      }

      DETECTED_NETWORK_TARGET = isAQA && canAccessDevnet ? (DEVNET_URL as NetworkType) : 'mainnet';

      console.log(`Network target: ${DETECTED_NETWORK_TARGET}`);
    }
  }

  return DETECTED_NETWORK_TARGET;
}

export function getAppDisplayName(): AppName {
  const apkPath = getAndroidApk();
  return isAutomaticQABuildAndroid(apkPath) ? 'Session AQA' : 'Session QA';
}
