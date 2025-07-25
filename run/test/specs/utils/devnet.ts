import { buildStateForTest } from '@session-foundation/qa-seeder';
import request from 'sync-request-curl';

import type { SupportedPlatformsType } from './open_app';

import { DEVNET_URL } from '../../../constants';
import { AppName } from '../../../types/testing';
import { getAndroidApk } from './binaries';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet

type NetworkType = Parameters<typeof buildStateForTest>[2];

// Using sync HTTP here to avoid cascading async changes through test init
// This runs at test startup, so blocking is acceptable
function canReachDevnet(): boolean {
  // Check if devnet is available
  try {
    const response = request('GET', DEVNET_URL, {
      timeout: 2000,
    });

    console.log(`Internal devnet is accessible (HTTP ${response.statusCode})`);
    return true;
  } catch {
    console.log('Internal devnet is not accessible');
    return false;
  }
}
function isAutomaticQABuildAndroid(apkPath: string): boolean {
  // Check env var first (for CI), then filename (for local)
  const isAutomaticQA = process.env.IS_AUTOMATIC_QA === 'true' || apkPath.includes('automaticQa');

  console.log(`${isAutomaticQA ? 'Automatic QA/devnet' : 'Regular/mainnet'} build detected`);

  return isAutomaticQA;
}
export function getNetworkTarget(platform: SupportedPlatformsType): NetworkType {
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
  const canAccessDevnet = canReachDevnet();
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
