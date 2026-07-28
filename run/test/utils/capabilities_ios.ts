import type { Capabilities } from '@wdio/types';

import type { ServiceNetwork } from '../../types/target';

import { W3CXCUITestDriverCaps } from 'appium-xcuitest-driver/build/lib/driver';
import dotenv from 'dotenv';
import { existsSync } from 'fs';

import { WDA_DERIVED_DATA_PATH, WDA_PREBUILT_APP_PATH } from '../../../scripts/build_wda';
import { resolveRunSimulators, type Simulator } from '../../../scripts/ios_shared';
import { IntRange } from '../../types/RangeType';

dotenv.config({ quiet: true });

export type IOSTestContext = {
  customInstallTime?: string;
  sessionProEnabled?: string;
};

type AppiumXCUITestCapabilities = Capabilities.AppiumXCUITestCapabilities;

export const IOS_PRO_CONTEXT: IOSTestContext = { sessionProEnabled: 'true' };

// --- Service network selection (mainnet / testnet / devnet) ---
//
// The iOS app (simulator build) reads `serviceNetwork` and, for devnet, the `devnet*` keys from
// its launch-arg env (DeveloperSettingsViewModel.processUnitTestEnvVariablesIfNeeded in Session_iOS).
// Running against a devnet avoids full mainnet onion-routing latency, which dominates the slowest
// multi-device tests. Selection comes from NETWORK_TARGET (the same var the workflows/report use);
// default stays mainnet so nothing changes unless NETWORK_TARGET is set.
//
// The devnet the *app* connects to (below) MUST be the same one the *seeder* points at
// (see getNetworkTarget in devnet.ts, which uses getIosDevnetSeedUrl()).

// Accepted `--network` values (forwarded to the child as NETWORK_TARGET). Kept in sync with
// `ServiceNetwork` via `satisfies` so this list can't drift from what capabilities_ios accepts.
export const ALLOWED_IOS_NETWORKS = [
  'mainnet',
  'testnet',
  'devnet',
] as const satisfies readonly ServiceNetwork[];

// The devnet seed node is a single node that plays two roles with THREE different ports, because
// the app and the qa-seeder talk to different services on it:
//   - rpcPort  (oxend RPC, HTTP)   -> the SEEDER hits `http://ip:rpcPort/json_rpc` (get_service_nodes)
//   - httpPort (storage HTTPS)     -> the APP's devnetHttpPort (Snode.httpsPort)
//   - omqPort  (storage OMQ/QUIC)  -> the APP's devnetOmqPort  (Snode.omqPort, the QUIC connection)
// On the Sesh-Net-Docker devnet these map to the `IP:RPC`, `Storage HTTPS` and `Storage OMQ`
// columns of the seed node's row (e.g. 1280 / 1300 / 1305 for the `oxend@1280` node).
export type IosDevnetConfig = {
  pubkey: string;
  ip: string;
  rpcPort: string;
  httpPort: string;
  omqPort: string;
};

export function getIosServiceNetwork(): ServiceNetwork {
  const raw = (process.env.NETWORK_TARGET ?? 'mainnet').trim().toLowerCase();
  if (raw === 'mainnet' || raw === 'testnet' || raw === 'devnet') {
    return raw;
  }
  throw new Error(
    `Invalid NETWORK_TARGET "${process.env.NETWORK_TARGET}". Use mainnet | testnet | devnet.`
  );
}

/**
 * Devnet connection details, read from the environment. Mirrors the validation the app itself does,
 * and throws (listing what's missing/invalid) so a misconfigured devnet run fails fast here rather
 * than the app silently falling back to testnet.
 */
export function getIosDevnetConfig(): IosDevnetConfig {
  const pubkey = (process.env.DEVNET_PUBKEY ?? '').trim();
  const ip = (process.env.DEVNET_IP ?? '').trim();
  const rpcPort = (process.env.DEVNET_RPC_PORT ?? '').trim();
  const httpPort = (process.env.DEVNET_HTTP_PORT ?? '').trim();
  const omqPort = (process.env.DEVNET_OMQ_PORT ?? '').trim();

  const isPort = (p: string) => /^\d{1,5}$/.test(p) && Number(p) <= 65535;

  const errors: string[] = [];
  if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
    errors.push('DEVNET_PUBKEY must be a 64-character hex string (seed node ed25519 pubkey)');
  }
  const octets = ip.split('.');
  if (octets.length !== 4 || !octets.every(o => /^\d{1,3}$/.test(o) && Number(o) <= 255)) {
    errors.push('DEVNET_IP must be an IPv4 address like 10.0.0.1');
  }
  if (!isPort(rpcPort)) {
    errors.push('DEVNET_RPC_PORT must be a number 0-65535 (seed oxend RPC, for the seeder)');
  }
  if (!isPort(httpPort)) {
    errors.push('DEVNET_HTTP_PORT must be a number 0-65535 (seed storage HTTPS, for the app)');
  }
  if (!isPort(omqPort)) {
    errors.push('DEVNET_OMQ_PORT must be a number 0-65535 (seed storage OMQ/QUIC, for the app)');
  }
  if (errors.length > 0) {
    throw new Error(
      `NETWORK_TARGET=devnet requires valid devnet env vars:\n  - ${errors.join('\n  - ')}`
    );
  }
  return { pubkey, ip, rpcPort, httpPort, omqPort };
}

/**
 * Seed URL the SEEDER (qa-seeder) uses for devnet — the seed node's oxend RPC (`/json_rpc`
 * get_service_nodes), which is a different port from the storage ports the app connects to.
 */
export function getIosDevnetSeedUrl(): `http://${string}` {
  const { ip, rpcPort } = getIosDevnetConfig();
  return `http://${ip}:${rpcPort}`;
}

/** Extra processArguments.env keys that point the app at the selected service network. */
function buildServiceNetworkEnv(): Record<string, string> {
  const network = getIosServiceNetwork();
  if (network === 'mainnet') {
    return {}; // app default — nothing to set
  }
  if (network === 'testnet') {
    return { serviceNetwork: 'testnet' };
  }
  const cfg = getIosDevnetConfig();
  return {
    serviceNetwork: 'devnet',
    devnetPubkey: cfg.pubkey,
    devnetIp: cfg.ip,
    devnetHttpPort: cfg.httpPort,
    devnetOmqPort: cfg.omqPort,
  };
}

/**
 * Optional custom file server (e.g. a local Sesh-Net-Docker file server). When `FILE_SERVER_URL`
 * is set, the app is pointed at it via `customFileServerUrl` (+ `customFileServerPubkey`), which
 * speeds up media tests. `FILE_SERVER_PUBKEY` is the file server's **X25519** pubkey: LibSession-Util
 * consumes it directly as `x25519_pubkey::from_hex(...)` (its built-in default `da21…` is an X25519
 * key) — it does NOT convert from ed25519, and the app passes this value to libsession raw. If
 * omitted the app falls back to its default file server pubkey. Independent of the network target —
 * but only really useful alongside a devnet.
 */
function buildCustomFileServerEnv(): Record<string, string> {
  const url = (process.env.FILE_SERVER_URL ?? '').trim();
  if (!url) {
    return {};
  }
  const pubkey = (process.env.FILE_SERVER_PUBKEY ?? '').trim();
  if (pubkey && !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
    throw new Error('FILE_SERVER_PUBKEY must be a 64-character hex string (X25519 pubkey)');
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
// is imported on Android- and Desktop-only runs too — `cross_platform_state` pulls in IOS_PRO_CONTEXT
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

export function getIosCapabilities(
  capabilitiesIndex: CapabilitiesIndexType,
  customCaps?: IOSTestContext
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

  // Build custom env entries from per-test overrides
  const customEnv: Record<string, string> = {};
  if (customCaps?.customInstallTime) {
    customEnv.customFirstInstallDateTime = customCaps.customInstallTime;
  }
  if (customCaps?.sessionProEnabled) {
    customEnv.sessionPro = customCaps.sessionProEnabled;
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
