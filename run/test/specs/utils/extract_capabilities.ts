import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

import { DEVNET_URL } from '../../../constants';

const ANDROID_AQA_PACKAGE_SUFFIX = '.qa';
const ANDROID_AQA_FILENAME_MARKER = 'automaticQa';

export interface AppInfo {
  packageName: string; // Android package name or (later) iOS bundle ID
  isAQABuild: boolean;
  platform: 'android' | 'ios';
}

/**
 * Check if we can reach the internal development network
 */
export function canReachInternalNetwork(): boolean {
  try {
    // Check if devnet is reachable using curl
    const httpCode = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 ${DEVNET_URL}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    // 000 means connection failed, anything else means devnet is reachable
    if (httpCode !== '000') {
      console.log(`✅ Internal devnet reachable (HTTP ${httpCode})`);
      return true;
    }
    console.log('❌ Internal devnet NOT reachable');
    return false;
  } catch {
    console.log('❌ Internal devnet NOT reachable');
    return false;
  }
}

/**
 * Find aapt tool for Android APK analysis
 */
function findAapt(): string | null {
  // Try to find aapt using ANDROID_SDK_ROOT first
  let aaptCommand = 'aapt';

  if (process.env.ANDROID_SDK_ROOT) {
    const buildToolsVersions = ['35.0.0', '34.0.0', '33.0.0', '32.0.0', '31.0.0', '30.0.3'];
    for (const version of buildToolsVersions) {
      const sdkAapt = path.join(process.env.ANDROID_SDK_ROOT, 'build-tools', version, 'aapt');
      if (existsSync(sdkAapt)) {
        aaptCommand = sdkAapt;
        console.log(`✅ Found aapt via ANDROID_SDK_ROOT (${version})`);
        return aaptCommand;
      }
    }
  }

  // Check if aapt is in PATH
  try {
    execSync('which aapt', { stdio: 'ignore' });
    console.log('✅ aapt found in PATH');
    return 'aapt';
  } catch {
    return null;
  }
}

/**
 * Detect Android package name from APK
 */
export function detectAndroidPackage(apkPath: string): AppInfo {
  try {
    const aaptCommand = findAapt();

    if (aaptCommand) {
      // Use aapt to get package name
      const output = execSync(`"${aaptCommand}" dump badging "${apkPath}" | grep package:`, {
        encoding: 'utf8',
      });
      const match = output.match(/package: name='([^']+)'/);
      const packageName = match ? match[1] : 'network.loki.messenger';
      console.log(`📦 aapt detected: ${packageName}`);

      return {
        packageName,
        isAQABuild: packageName.includes(ANDROID_AQA_PACKAGE_SUFFIX),
        platform: 'android',
      };
    }
  } catch (e) {
    // Fall through to filename detection
  }

  // Fallback: check filename
  console.log('⚠️  aapt not available, using filename detection...');
  const isAQA = apkPath.includes(ANDROID_AQA_FILENAME_MARKER);

  if (isAQA) {
    console.log(`📦 Filename contains "${ANDROID_AQA_FILENAME_MARKER}" → .qa package`);
    return {
      packageName: 'network.loki.messenger.qa',
      isAQABuild: true,
      platform: 'android',
    };
  }
  console.log('📦 Regular filename → regular package');
  return {
    packageName: 'network.loki.messenger',
    isAQABuild: false,
    platform: 'android',
  };
}

// TODO add in iOS bundle detection once we have the opportunity to do so

/**
 * Validate configuration and fail fast if mismatched
 */
export function validateConfiguration(appInfo: AppInfo): void {
  const canReachInternal = canReachInternalNetwork();

  console.log('\n🔍 Configuration check:');
  console.log(`  App type: ${appInfo.isAQABuild ? 'AQA Build' : 'Regular Build'}`);
  console.log(`  Platform: ${appInfo.platform}`);
  console.log(`  Internal network: ${canReachInternal ? 'Reachable' : 'Not reachable'}`);

  if (appInfo.isAQABuild && !canReachInternal) {
    throw new Error('Cannot use AQA build without internal network access');
  } else if (!appInfo.isAQABuild && canReachInternal) {
    console.warn('On internal network but using regular build - consider using AQA build');
  } else {
    console.log('Using AQA build with local devnet access - great success!');
  }
}

/**
 * Main entry point for capabilities detection
 */
export function detectCapabilities(appPath: string, platform: 'android' | 'ios'): AppInfo {
  console.log(`\n🎯 ${platform === 'android' ? 'Android' : 'iOS'} app path: ${appPath}`);

  let appInfo: AppInfo;

  if (platform === 'android') {
    appInfo = detectAndroidPackage(appPath);
  } else if (platform === 'ios') {
    throw new Error('iOS does not support devnet builds yet');
  } else {
    // TypeScript exhaustiveness check - this should never happen
    throw new Error(`Unknown platform`);
  }

  validateConfiguration(appInfo);

  return appInfo;
}
