import { buildStateForTest } from '@session-foundation/qa-seeder';

import type { ClientPlatform, ServiceNetwork } from '../../types/target';
import type { SupportedPlatformsType } from './open_app';

import { AppName } from '../../types/testing';
import { getAndroidApk } from './binaries';
import {
  getDevnetSeedUrl,
  getServiceNetwork,
  probeSeedNode,
  seedNodeAlreadyVerified,
} from './network_target';

// NOTE this currently only applies to Android as iOS doesn't supply AQA builds yet
type NetworkType = Parameters<typeof buildStateForTest>[2];

/**
 * Is this devnet usable? Delegates to the single probe in `network_target.ts` and logs the reason on
 * failure, so callers can stay a simple boolean check.
 *
 * Skips the request entirely for the configured seed node once discovery has run: discovery already
 * validated it, and more thoroughly (it also verified the advertised storage ports accept connections).
 */
async function isDevnetReachable(url: string): Promise<boolean> {
  if (seedNodeAlreadyVerified(url)) {
    return true;
  }

  const probe = await probeSeedNode(url);
  if (probe.usable) {
    console.log(`Devnet ${url} is usable (${probe.nodes.length} usable service node(s))`);
    return true;
  }

  console.log(`Devnet ${url} is not usable: ${probe.reason}`);
  return false;
}

/** Whether NETWORK_TARGET was explicitly set, as opposed to defaulting to mainnet. */
export function networkTargetIsExplicit(): boolean {
  return !!(process.env.NETWORK_TARGET ?? '').trim();
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
    // with NETWORK_TARGET (+ DEVNET_SEED_URL for devnet — see network_target.ts).
    const network = getServiceNetwork();

    if (network === 'devnet') {
      const seedUrl = getDevnetSeedUrl();
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

  const seedUrl = getDevnetSeedUrl();
  const canAccessDevnet = await isDevnetReachable(seedUrl);
  // If you pass an AQA build in the .env but can't access devnet, tests will fail
  if (isAQA && !canAccessDevnet) {
    throw new Error(
      `Cannot use an AQA build without a usable devnet at ${seedUrl} (reason logged above)`
    );
  }

  const resolvedTarget = canAccessDevnet ? seedUrl : 'mainnet';
  process.env.DETECTED_NETWORK_TARGET = resolvedTarget;
  console.log(`Network target: ${resolvedTarget}`);

  return resolvedTarget;
}

export function getAppDisplayName(): AppName {
  const apkPath = getAndroidApk();
  return isAutomaticQABuildAndroid(apkPath) ? 'Session AQA' : 'Session QA';
}

/**
 * Desktop's mainnet seed. Setting LOCAL_DEVNET_SEED_URL is the ONLY way to move Desktop off testnet,
 * because this harness always launches it with a `test-integration-*` NODE_APP_INSTANCE, which trips
 * the app's own `useTestNet` flag (see resolveDesktopTarget).
 */
/**
 * Session Desktop's seed nodes, from `window.getSeedNodeList()` in `app/preload.js`.
 *
 * Used for both directions: classifying which network a given LOCAL_DEVNET_SEED_URL points at (the var
 * name says "devnet", but it is really a plain seed-node override and is routinely pointed at mainnet),
 * and building the URL we pin when NETWORK_TARGET=mainnet. Sharing one source matters — classification
 * matches on host, so a pin whose host was missing from this list would read back as *devnet* and the
 * run would block itself with a bogus mismatch.
 */
const DESKTOP_MAINNET_SEED_HOSTS = [
  'seed1.getsession.org',
  'seed2.getsession.org',
  'seed3.getsession.org',
];
const DESKTOP_TESTNET_PORT = '38157';
/** seed2, for continuity with the value CI used to set by hand. */
const DESKTOP_MAINNET_SEED_URL = `https://${DESKTOP_MAINNET_SEED_HOSTS[1]}:4443`;

/**
 * Make NETWORK_TARGET the single switch for every platform, by deriving the per-platform knob each
 * client actually reads at launch. Call once, before anything is opened.
 *
 * Only Desktop needs anything done here: iOS reads NETWORK_TARGET directly, and Android is told its
 * network through launch intent extras built in `capabilities_android.ts`. Desktop instead reads
 * LOCAL_DEVNET_SEED_URL from its process environment when Electron starts, so we set that ourselves
 * rather than making everyone keep two variables in agreement by hand. This is the same mapping the
 * CI workflow used to do in bash, moved here so local runs behave identically.
 *
 * Deliberately a no-op when NETWORK_TARGET is unset: that keeps every existing setup (which selects
 * networks per-platform) working exactly as before.
 */
export function pinPlatformsToNetworkTarget(): void {
  if (!networkTargetIsExplicit()) {
    return;
  }

  const target = getServiceNetwork();
  const previous = (process.env.LOCAL_DEVNET_SEED_URL ?? '').trim();

  const desired =
    target === 'devnet' ? getDevnetSeedUrl() : target === 'mainnet' ? DESKTOP_MAINNET_SEED_URL : '';

  if (desired) {
    process.env.LOCAL_DEVNET_SEED_URL = desired;
  } else {
    delete process.env.LOCAL_DEVNET_SEED_URL;
  }

  if (previous && previous !== desired) {
    console.log(
      `NETWORK_TARGET=${target} overrides LOCAL_DEVNET_SEED_URL for Desktop ` +
        `(was ${previous}, now ${desired || '<unset, i.e. testnet>'})`
    );
  } else {
    console.log(
      `Desktop pinned to ${target} via LOCAL_DEVNET_SEED_URL=${desired || '<unset, i.e. testnet>'}`
    );
  }
}

// --- Global devnet gate ---
//
// Asking for devnet when the devnet is down must stop the WHOLE run, on every platform and every
// project, before a single app is launched. Previously each platform decided on its own and the
// coverage was uneven: iOS threw, Android only threw when the APK happened to be an AQA build, and
// Desktop never checked at all. Worse, `NETWORK_TARGET=devnet` with a non-AQA APK silently ran
// Android on mainnet. The result was a run that looked like a product bug instead of a dead devnet.

/** One configured devnet reference: which knob asked for it, and the seed URL it points at. */
export type RequestedDevnet = { source: string; url: string };

/**
 * Every devnet reference configured in this environment, independent of which platforms the run
 * will actually use. Deliberately env-driven rather than project-driven: `global-setup` cannot know
 * which projects Playwright is about to run, and "I asked for devnet" is a property of the config.
 *
 * Only reads a platform's config when that platform is actually configured (e.g. skips Android
 * entirely when ANDROID_APK is unset), so a desktop-only checkout isn't forced to set mobile vars.
 */
export function requestedDevnetRefs(): RequestedDevnet[] {
  const refs: RequestedDevnet[] = [];

  // Throws (listing what is missing/invalid) when NETWORK_TARGET=devnet but the DEVNET_* vars are
  // not usable — which is itself a misconfiguration worth failing the run for.
  if (getServiceNetwork() === 'devnet') {
    refs.push({
      source: 'NETWORK_TARGET=devnet (every client + the seeder)',
      url: getDevnetSeedUrl(),
    });
  }

  if (process.env.ANDROID_APK) {
    const android = resolveAndroidTarget();
    if (android.networkClass === 'devnet') {
      refs.push({ source: `Android AQA build (${android.knob})`, url: android.ref });
    }
  }

  const desktop = resolveDesktopTarget();
  if (desktop.networkClass === 'devnet') {
    refs.push({ source: 'LOCAL_DEVNET_SEED_URL (Desktop)', url: desktop.ref });
  }

  return refs;
}

/**
 * Fail the run if any configured devnet is unreachable. Called from `global-setup`, so it aborts
 * before any simulator, emulator or Electron window starts.
 *
 * Probes each DISTINCT url once: the common case is several platforms pointing at the same seed
 * node, and there is no reason to hit it three times.
 */
export async function assertRequestedDevnetsReachable(): Promise<void> {
  const refs = requestedDevnetRefs();
  if (refs.length === 0) {
    return;
  }

  const byUrl = new Map<string, string[]>();
  refs.forEach(({ source, url }) => byUrl.set(url, [...(byUrl.get(url) ?? []), source]));

  console.log(`Devnet requested — verifying ${byUrl.size} seed node(s) before starting the run:`);
  byUrl.forEach((sources, url) => console.log(`  ${url}  <- ${sources.join(', ')}`));

  const unreachable: string[] = [];
  for (const [url, sources] of byUrl) {
    if (!(await isDevnetReachable(url))) {
      unreachable.push(`  - ${url} (requested by: ${sources.join(', ')})`);
    }
  }

  if (unreachable.length > 0) {
    throw new Error(
      `Devnet was requested but is not usable, so the run is being stopped before any app ` +
        `starts (reasons logged above):\n${unreachable.join('\n')}\n` +
        `Either bring the devnet up, or set NETWORK_TARGET to mainnet/testnet.`
    );
  }
}

// --- Cross-platform network consistency ---
//
// Every platform picks its network from a DIFFERENT source, and none of them know about each
// other:
//   - iOS     : NETWORK_TARGET, injected as app launch args (capabilities_ios.ts)
//   - Android : the APK build variant (IS_AUTOMATIC_QA / an `automaticQa` filename) — NETWORK_TARGET
//               is ignored entirely, and the devnet URL is a compile-time constant in the app, so
//               Android cannot be pointed at a different devnet without a rebuild
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
  const networkClass = getServiceNetwork();
  return {
    platform: 'ios',
    networkClass,
    ref: networkClass === 'devnet' ? getDevnetSeedUrl() : networkClass,
    knob: 'NETWORK_TARGET (plus the DEVNET_* vars for devnet)',
  };
}

function resolveAndroidTarget(): ResolvedNetworkTarget {
  // With NETWORK_TARGET set, Android is told its network at launch like the other platforms, so the
  // APK variant no longer decides it. Without it, the variant is still the only signal we have.
  if (networkTargetIsExplicit()) {
    const networkClass = getServiceNetwork();
    return {
      platform: 'android',
      networkClass,
      ref: networkClass === 'devnet' ? getDevnetSeedUrl() : networkClass,
      knob: 'NETWORK_TARGET (passed to the app as launch intent extras)',
    };
  }

  const isAQA = isAutomaticQABuildAndroid(getAndroidApk());
  return {
    platform: 'android',
    networkClass: isAQA ? 'devnet' : 'mainnet',
    ref: isAQA ? getDevnetSeedUrl() : 'mainnet',
    knob: 'the ANDROID_APK build variant (IS_AUTOMATIC_QA=true or an `automaticQa` APK)',
  };
}

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
 *
 * `present` is deduped first: a platform's network is a property of the environment, not of how
 * many clients of it a test opens, so resolving it twice would only re-read the APK path, log
 * again, and name the platform twice in the mismatch error. One entry out per DISTINCT platform in.
 */
export function resolveNetworkTargets(present: Array<ClientPlatform>): ResolvedNetworkTarget[] {
  const resolvers: Record<ClientPlatform, () => ResolvedNetworkTarget> = {
    ios: resolveIosTarget,
    android: resolveAndroidTarget,
    desktop: resolveDesktopTarget,
  };

  return [...new Set(present)].map(platform => resolvers[platform]());
}

/**
 * Assert every platform taking part in a cross-platform test is on the SAME network, and return
 * that network for the seeder.
 *
 * Mismatched network *classes* (mainnet vs devnet) are fatal — that combination can never work.
 * Devnet URLs are only warned about, because the three platforms genuinely name the same node
 * differently: iOS and Android both resolve DEVNET_SEED_URL, while Desktop uses whatever
 * LOCAL_DEVNET_SEED_URL says (the harness sets it from NETWORK_TARGET, but a run that predates that
 * may still set it by hand). A textual difference is therefore not proof of a problem — but it IS the
 * thing to check first when a devnet run hangs.
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
  // endpoint (the `IP:RPC` port, 1280 on Sesh-Net-Docker) — Desktop passes it
  // straight to `getSnodesFromSeedUrl`, the same get_n_service_nodes call the seeder makes.
  // Android is preferred purely to preserve the pre-existing behaviour for android+desktop tests.
  //
  // A Record, not a list, so the compiler enforces coverage: a fourth ClientPlatform missing from
  // an `Array<ClientPlatform>` still typechecks and would leave a devnet run made up only of that
  // platform picking no ref at all. Here it is a build error instead.
  const seederPreference: Record<ClientPlatform, number> = { android: 0, ios: 1, desktop: 2 };
  // `resolved` is non-empty: `present` was checked above and dedupe keeps at least one entry.
  const seederRef = [...resolved].sort(
    (a, b) => seederPreference[a.platform] - seederPreference[b.platform]
  )[0].ref;

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
