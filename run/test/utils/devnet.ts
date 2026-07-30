import { buildStateForTest } from '@session-foundation/qa-seeder';

import type { SupportedPlatformsType } from './open_app';

import { getDevnetBootstrapUrl } from '../../shared/devnet_bootstrap';
import { sleepFor } from '../../shared/promise_utils';
import { AppName } from '../../types/testing';
import { getAndroidApk } from './binaries';
import { getIosDevnetSeedUrl, getIosServiceNetwork } from './capabilities_ios';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet
type NetworkType = Parameters<typeof buildStateForTest>[2];

/**
 * Checks the devnet by asking its oxend RPC for the service-node list — the same call the seeder
 * makes, so a pass means the address is genuinely usable rather than merely occupied.
 *
 * This deliberately does not `GET` the root. oxend answers `404` there (only `POST /json_rpc` is a
 * route), so a status-only check has to accept 404 as healthy — at which point *any* HTTP listener
 * passes, and pointing this at the SOGS port or a router page would report the devnet up and push the
 * real failure into the middle of a test run. It also logged "is accessible (HTTP 404)", which reads
 * like a fault when it isn't.
 */
async function isDevnetReachable(url: string = getDevnetBootstrapUrl()): Promise<boolean> {
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

      const response = await fetch(`${url}/json_rpc`, {
        body: JSON.stringify({ id: '0', jsonrpc: '2.0', method: 'get_service_nodes' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}/json_rpc`);
      }
      const body = (await response.json()) as {
        result?: { service_node_states?: { active?: boolean }[] };
      };
      const nodes = body.result?.service_node_states;
      if (!Array.isArray(nodes)) {
        // Something is listening and speaking HTTP, but it is not an oxend RPC.
        throw new Error(`${url} responded but returned no service_node_states — not a devnet?`);
      }

      // Node counts rather than a status code: an oxend reporting zero active nodes is reachable but
      // not yet usable, and that is worth seeing in the log rather than discovering mid-run.
      const active = nodes.filter(n => n.active).length;
      console.log(`Devnet ${url} is accessible (${nodes.length} service nodes, ${active} active)`);
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
export async function getNetworkTarget(platform: SupportedPlatformsType): Promise<NetworkType> {
  if (process.env.DETECTED_NETWORK_TARGET) {
    return process.env.DETECTED_NETWORK_TARGET as NetworkType;
  }
  if (platform === 'ios') {
    // iOS supports mainnet/testnet/devnet via the app's simulator launch-arg env
    // (DeveloperSettingsViewModel+Testing.swift). Default is mainnet; opt into devnet/testnet
    // with NETWORK_TARGET (+ DEVNET_* vars for devnet — see capabilities_ios.ts).
    const network = getIosServiceNetwork();

    if (network === 'devnet') {
      const seedUrl = getIosDevnetSeedUrl();
      const canAccessDevnet = await isDevnetReachable(seedUrl);
      if (!canAccessDevnet) {
        throw new Error(
          `NETWORK_TARGET=devnet, but the devnet seed node at ${seedUrl} is not reachable. ` +
            `Ensure the devnet is running/reachable, or set NETWORK_TARGET=mainnet.`
        );
      }
      process.env.DETECTED_NETWORK_TARGET = seedUrl;
      console.log(`Network target (iOS): devnet via ${seedUrl}`);
      return seedUrl;
    }

    if (network === 'testnet') {
      process.env.DETECTED_NETWORK_TARGET = 'testnet';
      console.log('Network target (iOS): testnet');
      return 'testnet';
    }

    process.env.DETECTED_NETWORK_TARGET = 'mainnet';
    console.log('Network target (iOS): mainnet');
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

  const devnetUrl = getDevnetBootstrapUrl();
  const canAccessDevnet = await isDevnetReachable(devnetUrl);
  // If you pass an AQA build in the .env but can't access devnet, tests will fail
  if (isAQA && !canAccessDevnet) {
    throw new Error(
      `Cannot use AQA build without internal network access (devnet ${devnetUrl} unreachable). ` +
        `Set DEVNET_BOOTSTRAP_HOST (or the DEVNET_BOOTSTRAP workflow input) if the devnet moved.`
    );
  }
  // If the devnet is available, mainnet is still an option but you *could* switch to an AQA build
  if (!isAQA && canAccessDevnet) {
    console.log('The internal devnet is available, but using regular build');
  }

  const resolvedTarget = isAQA && canAccessDevnet ? devnetUrl : 'mainnet';
  process.env.DETECTED_NETWORK_TARGET = resolvedTarget;
  console.log(`Network target: ${resolvedTarget}`);

  return resolvedTarget;
}

export function getAppDisplayName(): AppName {
  const apkPath = getAndroidApk();
  return isAutomaticQABuildAndroid(apkPath) ? 'Session AQA' : 'Session QA';
}
