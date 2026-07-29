import { buildStateForTest } from '@session-foundation/qa-seeder';

import type { ClientPlatform, ServiceNetwork } from '../../types/target';
import type { SupportedPlatformsType } from './open_app';

import { DEVNET_URL } from '../../constants';
import { sleepFor } from '../../shared/promise_utils';
import { AppName } from '../../types/testing';
import { getAndroidApk } from './binaries';
import { getIosDevnetSeedUrl, getIosServiceNetwork } from './capabilities_ios';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet
type NetworkType = Parameters<typeof buildStateForTest>[2];

/**
 * Number of active service nodes in an oxend `get_n_service_nodes` reply, or `undefined` if the
 * payload isn't one. Narrows off `unknown` so a wrong service answering the port can't be mistaken
 * for a seed node.
 */
function activeSnodeCount(payload: unknown): number | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const { result } = payload as { result?: unknown };
  if (typeof result !== 'object' || result === null) {
    return undefined;
  }
  const { service_node_states: states } = result as { service_node_states?: unknown };
  return Array.isArray(states) ? states.length : undefined;
}

/**
 * Minimum number of active service nodes the probe accepts as "the registry is populated" — a local
 * devnet brings up ~12.
 */
const SEED_PROBE_MIN_NODES = 5;

/**
 * How many the probe asks for. Capped because an unlimited `get_n_service_nodes` returns every node
 * on the network (>1000 states on mainnet), and kept strictly ABOVE the minimum: `limit` truncates
 * the reply, so with `limit === SEED_PROBE_MIN_NODES` the count check could only ever pass at
 * exactly the cap, and raising the minimum alone would make it unsatisfiable.
 */
const SEED_PROBE_LIMIT = SEED_PROBE_MIN_NODES * 2;

/**
 * A seed node is only usable if its oxend RPC answers the request its consumers actually make:
 * `get_n_service_nodes` on `/json_rpc`, the same call Desktop's `getSnodesFromSeedUrl` and the
 * qa-seeder (`@session-foundation/network-requests`) send, returning at least
 * `SEED_PROBE_MIN_NODES` active nodes.
 * `active_only` / `limit` / `fields` are exactly the params those consumers use — the qa-seeder's
 * `GetSnodesFromSeed` sends all three (with `limit: 20`), while Desktop omits `limit` on purpose
 * because it prunes cached swarms against the reply, which a liveness probe doesn't do.
 *
 * A bare GET liveness probe is not enough: any listener on the port passes it — a 404, an unrelated
 * service, or an oxend that has come up with zero registered nodes (routine on a freshly started
 * Sesh-Net-Docker stack). All three then hang the test to the timeout with no clue why.
 */
async function isDevnetReachable(url: string = DEVNET_URL): Promise<boolean> {
  const isCI = process.env.CI === '1';
  const maxAttempts = isCI ? 3 : 1;
  const timeout = isCI ? 10_000 : 2_000;

  const endpoint = `${url.replace(/\/$/, '')}/json_rpc`;
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: '0',
    method: 'get_n_service_nodes',
    params: {
      active_only: true,
      limit: SEED_PROBE_LIMIT,
      fields: { public_ip: true, storage_port: true },
    },
  });

  // Check if devnet is available
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      if (maxAttempts > 1) {
        console.log(`Checking devnet accessibility (attempt ${attempt}/${maxAttempts})...`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const count = activeSnodeCount((await response.json()) as unknown);
      if (count === undefined) {
        throw new Error('not an oxend RPC endpoint (no result.service_node_states in the reply)');
      }
      if (count < SEED_PROBE_MIN_NODES) {
        throw new Error(
          `oxend RPC answered but only ${count} active service node(s) are registered ` +
            `(need at least ${SEED_PROBE_MIN_NODES})`
        );
      }

      console.log(`Devnet ${url} is usable (at least ${count} active service nodes)`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (attempt === maxAttempts) {
        console.log(`Devnet ${url} is not usable: ${errorMsg}`);
      } else {
        console.log(`Attempt ${attempt} failed: ${errorMsg}, retrying...`);
        await sleepFor(attempt * 1000);
      }
    } finally {
      clearTimeout(timeoutId);
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
          `NETWORK_TARGET=devnet, but the devnet seed node at ${seedUrl} is not usable ` +
            `(reason logged above). Ensure the devnet is running and has registered service ` +
            `nodes, or set NETWORK_TARGET=mainnet.`
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

// --- Cross-platform network consistency ---
//
// Every platform picks its network from a DIFFERENT source, and none of them know about each
// other:
//   - iOS     : NETWORK_TARGET, injected as app launch args (capabilities_ios.ts)
//   - Android : the APK build variant (IS_AUTOMATIC_QA / an `automaticQa` filename) — NETWORK_TARGET
//               is ignored entirely
//   - Desktop : LOCAL_DEVNET_SEED_URL, which despite the name is a general seed-node override and
//               DEFAULTS TO TESTNET here (not mainnet) — see resolveDesktopTarget below
//
// So the out-of-the-box combination (iOS mainnet + Desktop testnet) does NOT agree; Desktop has to
// be pinned with LOCAL_DEVNET_SEED_URL, or iOS moved with NETWORK_TARGET.
//
// If they disagree, the seeder writes the account onto one network while a client polls another,
// and the test simply hangs until the 480s timeout with no clue why. `getNetworkTarget` can't
// catch this: it memoises into DETECTED_NETWORK_TARGET and returns early, so calling it once per
// platform silently resolves only the first one.

export type ResolvedNetworkTarget = {
  platform: ClientPlatform;
  /** Which network this platform is pointed at. Mismatches here are fatal. */
  networkClass: ServiceNetwork;
  /** How this platform refers to that network — a seed URL for devnet, else the network name. */
  ref: NetworkType;
  /** What to change to move this platform to another network. Used in the error message. */
  knob: string;
};

function resolveIosTarget(): ResolvedNetworkTarget {
  const networkClass = getIosServiceNetwork();
  return {
    platform: 'ios',
    networkClass,
    ref: networkClass === 'devnet' ? getIosDevnetSeedUrl() : networkClass,
    knob: 'NETWORK_TARGET (plus the DEVNET_* vars for devnet)',
  };
}

function resolveAndroidTarget(): ResolvedNetworkTarget {
  const isAQA = isAutomaticQABuildAndroid(getAndroidApk());
  return {
    platform: 'android',
    networkClass: isAQA ? 'devnet' : 'mainnet',
    ref: isAQA ? DEVNET_URL : 'mainnet',
    knob: 'the ANDROID_APK build variant (IS_AUTOMATIC_QA=true or an `automaticQa` APK)',
  };
}

/**
 * Session Desktop's seed nodes, from `window.getSeedNodeList()` in `app/preload.js`. Used to work
 * out which network a given LOCAL_DEVNET_SEED_URL actually points at — the var name says "devnet",
 * but it is really a plain seed-node override and is routinely pointed at mainnet or testnet.
 */
const DESKTOP_MAINNET_SEED_HOSTS = [
  'seed1.getsession.org',
  'seed2.getsession.org',
  'seed3.getsession.org',
];
const DESKTOP_TESTNET_PORT = '38157';

function resolveDesktopTarget(): ResolvedNetworkTarget {
  const seedUrl = (process.env.LOCAL_DEVNET_SEED_URL ?? '').trim();
  const knob = 'LOCAL_DEVNET_SEED_URL (and the SESSION_DESKTOP_ROOT build it matches)';

  // NOT mainnet when unset. Desktop's `useTestNet` flag is `isTestNet() || isTestIntegration()`,
  // and this harness always launches with NODE_APP_INSTANCE=`test-integration-...` (see
  // MULTI_PREFIX in run/desktop/open.ts), so `isTestIntegration()` is always true and
  // `getSeedNodeList()` falls through to the testnet seed. Setting LOCAL_DEVNET_SEED_URL is the
  // only way to move Desktop off testnet — including to pin it to mainnet.
  if (!seedUrl) {
    return {
      platform: 'desktop',
      networkClass: 'testnet',
      ref: 'testnet',
      knob,
    };
  }
  const invalidSeedUrl = () =>
    new Error(
      `LOCAL_DEVNET_SEED_URL must be an http(s) URL (got "${seedUrl}"). ` +
        `Unset it to let Desktop use its default (testnet under this harness).`
    );

  // `getSeedNodeList()` returns [seedUrl] verbatim, so the URL alone decides the network. Parse
  // rather than string-match on "http": a value like `http-devnet` passes a `startsWith` check and
  // then dies with a bare `TypeError: Invalid URL`, and `httpx://host` would parse and be silently
  // accepted as a devnet seed.
  let parsed: URL;
  try {
    parsed = new URL(seedUrl);
  } catch {
    throw invalidSeedUrl();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalidSeedUrl();
  }
  if (DESKTOP_MAINNET_SEED_HOSTS.includes(parsed.hostname)) {
    const networkClass: ServiceNetwork =
      parsed.port === DESKTOP_TESTNET_PORT ? 'testnet' : 'mainnet';
    return { platform: 'desktop', networkClass, ref: networkClass, knob };
  }
  return { platform: 'desktop', networkClass: 'devnet', ref: seedUrl as `http${string}`, knob };
}

/**
 * Resolve the network each given platform is actually pointed at. Unlike `getNetworkTarget` this
 * never consults or writes the DETECTED_NETWORK_TARGET cache, so every platform is really resolved.
 */
export function resolveNetworkTargets(present: Array<ClientPlatform>): ResolvedNetworkTarget[] {
  const resolvers: Record<ClientPlatform, () => ResolvedNetworkTarget> = {
    ios: resolveIosTarget,
    android: resolveAndroidTarget,
    desktop: resolveDesktopTarget,
  };
  return present.map(platform => resolvers[platform]());
}

/**
 * Assert every platform taking part in a cross-platform test is on the SAME network, and return
 * that network for the seeder.
 *
 * Mismatched network *classes* (mainnet vs devnet) are fatal — that combination can never work.
 * Devnet URLs are only warned about: the platforms legitimately refer to the same devnet in
 * different shapes (iOS builds `http://DEVNET_IP:DEVNET_RPC_PORT`, Android uses the DEVNET_URL
 * constant, Desktop uses LOCAL_DEVNET_SEED_URL), so a textual difference is not proof of a problem.
 */
export async function assertConsistentNetworkTarget(
  present: Array<ClientPlatform>
): Promise<NetworkType> {
  if (present.length === 0) {
    throw new Error('assertConsistentNetworkTarget: no platforms given');
  }
  const resolved = resolveNetworkTargets(present);
  const describe = (t: ResolvedNetworkTarget) =>
    `  - ${t.platform}: ${t.networkClass} (${t.ref})\n      change with: ${t.knob}`;

  const classes = new Set(resolved.map(t => t.networkClass));
  if (classes.size > 1) {
    throw new Error(
      `Cross-platform network mismatch: the clients in this test are pointed at different ` +
        `Session networks, so the account would never sync.\n` +
        `${resolved.map(describe).join('\n')}\n` +
        `Point every platform at the same network before re-running.`
    );
  }

  const [networkClass] = [...classes];
  console.log(`Network target (cross-platform): ${networkClass}`);
  resolved.forEach(t => console.log(`  ${t.platform} -> ${t.ref}`));

  if (networkClass === 'mainnet' || networkClass === 'testnet') {
    process.env.DETECTED_NETWORK_TARGET = networkClass;
    return networkClass;
  }

  // Devnet: warn on differing references, then verify the seed node the seeder will use is up.
  const refs = new Set(resolved.map(t => t.ref));
  if (refs.size > 1) {
    console.warn(
      `Warning: platforms reference the devnet by different URLs (${[...refs].join(', ')}). ` +
        `This is expected when they address the same seed node on different ports, but if the ` +
        `test hangs, check they really are the same devnet.`
    );
  }

  // Any platform's devnet ref works as the seeder URL: all three are the seed node's oxend RPC
  // endpoint (the `IP:RPC` / DEVNET_RPC_PORT port, 1280 on Sesh-Net-Docker) — Desktop passes it
  // straight to `getSnodesFromSeedUrl`, the same get_n_service_nodes call the seeder makes.
  // Android is preferred purely to preserve the pre-existing behaviour for android+desktop tests.
  const order: Array<ClientPlatform> = ['android', 'ios', 'desktop'];
  const seederRef = order
    .map(p => resolved.find(t => t.platform === p))
    .find((t): t is ResolvedNetworkTarget => t !== undefined)!.ref;

  // Every distinct ref has to be up, not just the seeder's: a client pointed at a dead seed node
  // hangs the test to the timeout with no clue why, even when the seeder's own endpoint is fine.
  // Sequential: `refs` holds a single entry in the common case, so there is nothing to overlap.
  const unreachable: Array<NetworkType> = [];
  for (const ref of refs) {
    if (!(await isDevnetReachable(ref))) {
      unreachable.push(ref);
    }
  }
  if (unreachable.length > 0) {
    const plural = unreachable.length > 1;
    throw new Error(
      `The devnet seed node${plural ? 's' : ''} at ${unreachable.join(', ')} ` +
        `${plural ? 'are' : 'is'} not usable (reason logged above), but every client in this ` +
        `test is configured for devnet:\n${resolved.map(describe).join('\n')}`
    );
  }
  process.env.DETECTED_NETWORK_TARGET = seederRef;
  return seederRef;
}
