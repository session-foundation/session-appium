import { execSync } from 'child_process';

import { DEVNET_URL } from '../../../constants';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet

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
