import { execSync } from 'child_process';

import { DEVNET_URL } from '../../../constants';


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

// extract_capabilities.ts
export function isAQABuildAndroid(apkPath: string): boolean {
  // Check env var first (for CI), then filename (for local)
  const isAutomaticQA = process.env.IS_AUTOMATIC_QA === 'true' || 
                        apkPath.includes('automaticQa');
  
  console.log(`📦 ${isAutomaticQA ? 'AutomaticQA' : 'Regular'} build detected`);
  
  return isAutomaticQA;
}
// TODO add in iOS bundle detection once we have the opportunity to do so
