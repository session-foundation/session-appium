import type { Capabilities } from '@wdio/types';

import { W3CXCUITestDriverCaps } from 'appium-xcuitest-driver/build/lib/driver';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

import type { IOSOnlyContext, MobileTestContext, ProContext } from './pro_context';

import { WDA_DERIVED_DATA_PATH, WDA_PREBUILT_APP_PATH } from '../../../scripts/build_wda';
import { resolveRunSimulators, type Simulator } from '../../../scripts/ios_shared';
import { IntRange } from '../../types/RangeType';
import { getResolvedDevnetSeedNode, getServiceNetwork } from './network_target';

dotenv.config({ quiet: true });

/**
 * The context field iOS reads -> the env key the app reads.
 *
 * How the mocks reach the app on iOS: launch-arg env variables read by
 * `DeveloperSettingsViewModel.processUnitTestEnvVariablesIfNeeded`, compiled only under
 * `#if targetEnvironment(simulator)`. The vocabulary itself is shared — see `pro_context.ts`.
 *
 * Exhaustive over the context iOS reads — the shared `ProContext` plus its own half — so a field added to
 * either is a compile error until it is wired up here rather than a mock that silently does nothing. The
 * app's `EnvironmentVariable` enum is `String`-backed with no explicit raw values, so each key is that
 * case's name verbatim.
 */
const IOS_TEST_ENV_KEYS: Record<keyof (ProContext & IOSOnlyContext), string> = {
  iosCustomInstallTime: 'customFirstInstallDateTime',
  proBackendStatus: 'mockCurrentUserSessionProBackendStatus',
  proLoadingState: 'mockCurrentUserSessionProLoadingState',
  proOriginatingPlatform: 'mockCurrentUserSessionProOriginatingPlatform',
  proOriginatingAccount: 'mockCurrentUserOriginatingAccount',
  proRefundingStatus: 'mockCurrentUserSessionProRefundingStatus',
  proAutoRenewing: 'mockCurrentUserSessionProAutoRenewing',
  proQuickRefundWindow: 'mockCurrentUserSessionProQuickRefundWindow',
  iosProBuildVariant: 'mockCurrentUserSessionProBuildVariant',
  proAccessExpiry: 'mockCurrentUserAccessExpiryTimestamp',
  proProof: 'mockCurrentUserSessionProProof',
  proBackendUrl: 'customProBackendUrl',
  proBackendPubkey: 'customProBackendPubkey',
  forceProRevocationRefresh: 'forceProRevocationRefresh',
};

type AppiumXCUITestCapabilities = Capabilities.AppiumXCUITestCapabilities;

// --- Service network selection (mainnet / testnet / devnet) ---
//
// The iOS app (simulator build) reads `serviceNetwork` and, for devnet, the `devnet*` keys from
// its launch-arg env (DeveloperSettingsViewModel.processUnitTestEnvVariablesIfNeeded in Session_iOS).
// Running against a devnet avoids full mainnet onion-routing latency, which dominates the slowest
// multi-device tests. Selection comes from NETWORK_TARGET (the same var the workflows/report use);
// default stays mainnet so nothing changes unless NETWORK_TARGET is set.
//
// The devnet the *app* connects to (below) MUST be the same one the *seeder* points at
// (see resolveNetworkTarget in devnet.ts, which uses getDevnetSeedUrl()).

/** Extra processArguments.env keys that point the app at the selected service network. */
function buildServiceNetworkEnv(): Record<string, string> {
  const network = getServiceNetwork();
  if (network === 'mainnet') {
    return {}; // app default — nothing to set
  }
  if (network === 'testnet') {
    return { serviceNetwork: 'testnet' };
  }
  // Discovered from the seed node rather than configured: a hand-copied pubkey rots on every devnet
  // rebuild and the storage ports were verified by nothing. See network_target.ts.
  const node = getResolvedDevnetSeedNode();
  return {
    serviceNetwork: 'devnet',
    devnetPubkey: node.pubkey,
    devnetIp: node.ip,
    devnetHttpPort: node.httpPort,
    devnetOmqPort: node.omqPort,
  };
}

/**
 * Optional custom file server (e.g. a local Sesh-Net-Docker file server). When `FILE_SERVER_URL`
 * is set, the app is pointed at it via `customFileServerUrl` (+ `customFileServerPubkey`), which
 * speeds up media tests. If the pubkey is omitted the app falls back to its own default file server
 * key. Independent of the network target — but only really useful alongside a devnet.
 *
 * `FILE_SERVER_ED_PUBKEY` is the server's **Ed25519** key, the same value every platform is given.
 * iOS stores it as the Ed key and derives the X25519 form when it needs one
 * (`FileServer.defaultEdPublicKey` / `x25519PublicKey(for:)` in SessionNetworkingKit), so it is passed
 * through unconverted.
 */
function buildCustomFileServerEnv(): Record<string, string> {
  const url = (process.env.FILE_SERVER_URL ?? '').trim();
  if (!url) {
    return {};
  }
  // Handing iOS the X25519 form instead is not a configuration error that reports itself: the `p=`
  // fragment of a download url carries whatever key it was given, other clients read that fragment as
  // an Ed key, and an X25519 value there is rejected as an invalid curve point — so the symptom is a
  // download that never resolves, on the other side of the transfer.
  const pubkey = (process.env.FILE_SERVER_ED_PUBKEY ?? '').trim();
  if (pubkey && !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
    throw new Error('FILE_SERVER_ED_PUBKEY must be a 64-character hex string (Ed25519 pubkey)');
  }
  return {
    customFileServerUrl: url,
    ...(pubkey ? { customFileServerPubkey: pubkey } : {}),
  };
}

// Resolved lazily and memoised on first iOS capability build (NOT at module load): this file is
// also imported on Android runs, where NETWORK_TARGET may be `devnet` — we must not try to read
// (and throw on) the iOS-only DEVNET_*/FILE_SERVER_* vars there. getIosCapabilities is iOS-only, so
// validation happens exactly when/where it's relevant.
let appEnvOverridesCache: Record<string, string> | undefined;
function getAppEnvOverrides(): Record<string, string> {
  if (appEnvOverridesCache === undefined) {
    appEnvOverridesCache = { ...buildServiceNetworkEnv(), ...buildCustomFileServerEnv() };
  }
  return appEnvOverridesCache;
}

export const iOSBundleId = 'com.loki-project.loki-messenger';

// Resolved lazily (NOT at module load) for the same reason as `getAppEnvOverrides` above: this module
// is imported on Android- and Desktop-only runs too — `cross_platform_state` pulls in PRO_BACKEND_CONTEXT
// — and throwing at import time would make those runs impossible without a full iOS setup. Every throw
// below now fires only when an iOS capability is actually built.
let iosAppFullPathCache: string | undefined;
function getIosAppFullPath(): string {
  if (iosAppFullPathCache === undefined) {
    const iosPathPrefix = process.env.IOS_APP_PATH_PREFIX;
    if (!iosPathPrefix) {
      throw new Error('IOS_APP_PATH_PREFIX environment variable is not set');
    }
    iosAppFullPathCache = iosPathPrefix;
    console.log(`iOS app full path: ${iosAppFullPathCache}`);
  }
  return iosAppFullPathCache;
}

// Reuse a prebuilt WebDriverAgent runner instead of building/launching WDA via `xcodebuild` on
// every session. Freshly-created simulators have no WDA installed, so without this the driver
// rebuilds+launches WDA per session — the slowest, flakiest part of startup on a cold clone (it
// intermittently dies before binding wdaLocalPort → `ECONNREFUSED 127.0.0.1:<port>`) and forces a
// redundant reinstall of the app-under-test around the test runner. With a prebuilt runner the
// driver installs it with `simctl` and launches it directly — no per-session xcodebuild.
//
// Build it once with `pnpm build-wda` (run_ios_parallel does this automatically). These caps only
// activate when the prebuilt runner actually exists, so plain `pnpm test-ios` / CI runs that
// haven't built it fall back to the driver's default build-per-session behaviour.
// Typed loosely because the @wdio caps type doesn't declare the prebuilt-WDA keys; the shared
// template below is `as`-cast to AppiumXCUITestCapabilities, which is where they get applied.
const wdaCapabilities: Record<string, boolean | number | string> = existsSync(WDA_PREBUILT_APP_PATH)
  ? {
      'appium:usePreinstalledWDA': true,
      'appium:prebuiltWDAPath': WDA_PREBUILT_APP_PATH,
      'appium:derivedDataPath': WDA_DERIVED_DATA_PATH,
      'appium:wdaLaunchTimeout': 120000,
      'appium:wdaConnectionTimeout': 120000,
    }
  : {};

if (Object.keys(wdaCapabilities).length === 0) {
  console.log('No prebuilt WDA found — WDA will build per session. Run `pnpm build-wda` to reuse.');
}

const sharediOSCapabilities: AppiumXCUITestCapabilities = {
  ...wdaCapabilities,
  'appium:platformName': 'iOS',
  'appium:platformVersion': '26.2',
  'appium:deviceName': 'iPhone 17',
  'appium:automationName': 'XCUITest',
  'appium:bundleId': iOSBundleId,
  'appium:newCommandTimeout': 600000,
  'appium:useNewWDA': false,
  'appium:showXcodeLog': false,
  'appium:autoDismissAlerts': false,
  'appium:reduceMotion': true,
  // WDA waits for the app to be idle before each command. A disappearing-message countdown repaints
  // every second, so the app never becomes idle and the wait runs to WDA's own limit — single
  // findElements calls have been measured at 21s and 60s. This bounds that wait rather than removing
  // it: ordinary screens still get synchronised, a ticking one costs a second.
  'appium:waitForIdleTimeout': 1,
  'appium:processArguments': {
    env: {
      debugDisappearingMessageDurations: 'true',
      communityPollLimit: '3',
      animationsEnabled: 'false',
    },
  },
} as AppiumXCUITestCapabilities;

// Re-exported for the scripts that build/clean simulators; the resolution itself lives in
// scripts/ios_shared so global-setup can use it without importing this iOS-only module.
export type { Simulator };

// Ports where global-setup started a long-lived WebDriverAgent (local runs only). Devices covered
// here attach to that WDA via `webDriverAgentUrl`, which reduces the driver's WDA launch to a single
// `/status` call — it skips both the per-session install AND the cross-device lock that otherwise
// serialises session startup (~8s saved on a 3-device test). Anything not listed keeps the
// prebuilt-WDA path below, so a WDA that failed to start just costs speed, not correctness.
const wdaReusePorts = new Set(
  (process.env.WDA_REUSE_PORTS ?? '')
    .split(',')
    .map(port => parseInt(port.trim()))
    .filter(port => Number.isFinite(port))
);

// Lazily resolved and memoised, for the same reason as getIosAppFullPath: `resolveRunSimulators`
// throws when no simulator is configured, which must not happen merely because this module was
// imported by a Desktop- or Android-only run.
let capabilitiesCache: Array<AppiumXCUITestCapabilities> | undefined;
function getCapabilities(): Array<AppiumXCUITestCapabilities> {
  if (capabilitiesCache !== undefined) {
    return capabilitiesCache;
  }

  capabilitiesCache = resolveRunSimulators().map(sim => {
    const base = {
      ...sharediOSCapabilities,
      'appium:app': getIosAppFullPath(),
      'appium:udid': sim.udid,
      'appium:wdaLocalPort': sim.wdaPort,
    } as Record<string, unknown>;

    if (wdaReusePorts.has(sim.wdaPort)) {
      // `usePreinstalledWDA` must go: the driver still runs its install step when that cap is set,
      // even though `webDriverAgentUrl` takes precedence for the launch itself.
      delete base['appium:usePreinstalledWDA'];
      delete base['appium:prebuiltWDAPath'];
      base['appium:webDriverAgentUrl'] = `http://127.0.0.1:${sim.wdaPort}`;
    }

    return base as AppiumXCUITestCapabilities;
  });

  return capabilitiesCache;
}

// Use a constant max that matches the envVars array length for type safety
const _MAX_CAPABILITIES_INDEX = 12 as const;

// For runtime validation, check against actual loaded simulators
export const getMaxCapabilitiesIndex = () => getCapabilities().length;

// Type is still based on the constant for compile-time safety
export type CapabilitiesIndexType = IntRange<0, typeof _MAX_CAPABILITIES_INDEX>;

export function capabilityIsValid(
  capabilitiesIndex: number
): capabilitiesIndex is CapabilitiesIndexType {
  // Runtime validation against actual loaded capabilities
  if (capabilitiesIndex < 0 || capabilitiesIndex >= getCapabilities().length) {
    return false;
  }
  return true;
}

/**
 * Stop a session's capabilities depending on a WebDriverAgent that global setup started.
 *
 * `webDriverAgentUrl` makes the driver assume WDA is already answering, so a runner that dies after
 * preparation turns every later session on that device into a hard failure — the driver never falls
 * back, and the retry re-reads the same capabilities and fails identically. That is what the residual
 * "failed to open the iOS app" failures are, and the prepared runner is exactly what makes them
 * invisible: the fast path has no way to notice it stopped being available.
 *
 * Dropping the URL returns the session to the path it would have taken had preparation never run, which
 * is slower and self-sufficient — it launches its own WDA.
 */
export function withoutPreparedWda(capabilities: W3CXCUITestDriverCaps): W3CXCUITestDriverCaps {
  const next = structuredClone(capabilities);
  delete next.alwaysMatch['appium:webDriverAgentUrl'];
  Object.assign(next.alwaysMatch, wdaCapabilities);
  return next;
}

export function getIosCapabilities(
  capabilitiesIndex: CapabilitiesIndexType,
  customCaps?: MobileTestContext
): W3CXCUITestDriverCaps {
  const capabilities = getCapabilities();
  if (capabilitiesIndex >= capabilities.length) {
    throw new Error(
      `Asked invalid ios cap index: ${capabilitiesIndex}. Number of iOS capabilities: ${capabilities.length}.`
    );
  }

  // Deep clone the capabilities object so we never mutate the shared global template.
  // Appium caps contain nested objects, so shallow clone ({...obj}) is not safe.
  const caps = structuredClone(capabilities[capabilitiesIndex]);

  // Extract the existing env block inside appium:processArguments.
  const baseEnv =
    (caps['appium:processArguments'] as { env?: Record<string, string> } | undefined)?.env ?? {};

  // Build custom env entries from per-test overrides. Unset fields are simply absent, which leaves
  // the app on its real value — the same thing an explicit 'useActual' asks for.
  const customEnv: Record<string, string> = {};
  for (const [field, envKey] of Object.entries(IOS_TEST_ENV_KEYS)) {
    const value = customCaps?.[field as keyof MobileTestContext];
    if (value) {
      // The launch-arg env is string-valued, so a boolean hook arrives here as `true` and has to be
      // spelled out. `'true'` rather than `'1'` because the app parses the two consistently and the
      // string form is what reads correctly in a device log.
      customEnv[envKey] = value === true ? 'true' : value;
    }
  }

  // Rebuild the processArguments block with merged env vars.
  // App env overrides (network selection + optional custom file server) sit under per-test customEnv.
  caps['appium:processArguments'] = {
    env: { ...baseEnv, ...getAppEnvOverrides(), ...customEnv },
  };

  return {
    firstMatch: [{}],
    alwaysMatch: caps,
  } as W3CXCUITestDriverCaps;
}

export function getCapabilitiesForWorker(workerId: number) {
  const capabilities = getCapabilities();
  const emulator = capabilities[workerId % capabilities.length];
  return {
    ...sharediOSCapabilities,
    'appium:udid': emulator['appium:udid'],
    'appium:wdaLocalPort': emulator['appium:wdaLocalPort'],
  };
}
