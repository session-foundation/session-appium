// Changes for this repo: `chalk` colouring removed (avoids an ESM-only dep in a
// CJS project), catch-clause error access cast for the stricter tsconfig, and
// ELECTRON_RUN_AS_NODE stripped from the launch env (see the launch call below).
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import { isEmpty } from 'lodash';
import { randomUUID } from 'node:crypto';
import { join } from 'path';

import { sleepFor } from '../shared/promise_utils';
import { applyProMocks, type DesktopProContext } from './pro_mocks';

const logNodeConsole = process.env.LOG_NODE_CONSOLE === '1';

export const NODE_ENV = 'production';
export const MULTI_PREFIX = 'test-integration';
/**
 * The `MULTI` suffixes `openApps` assigns, in order — index `i` is the same window as index `i` in
 * `getLaunchedInstances()`, which is what lets a window be restarted onto its own user-data directory.
 */
export const multisAvailable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let electronPids: Array<number> = [];
/**
 * The `NODE_APP_INSTANCE` each window was launched with, in launch order. A restart has to reuse its
 * window's value or the app comes up against a different user-data directory — i.e. signed out.
 */
let launchedInstances: Array<string> = [];
/** Live pid per `NODE_APP_INSTANCE`, so a restart can kill the process still holding that profile. */
const pidByInstance = new Map<string, number>();

export type TestContext = {
  dbCreationTimestampMs?: number;
  networkPageNodeCount?: number;
  /** Presence of this also tags the test `@pro`, so the tag cannot drift from the state under test. */
  pro?: DesktopProContext;
  /**
   * How many community rooms this test needs of its own, mirroring `sessionIt`'s option. Only
   * meaningful against a local SOGS, where `getCommunities()` throws rather than hand back shared
   * rooms to a test that did not declare a count.
   */
  communityRooms?: number;
  /**
   * Absolute path to the image the app's test-integration avatar picker should return. Without it
   * the picker yields a generated solid-colour JPEG, so nothing animated can ever be selected.
   */
  fakeAvatarPickerFile?: string;
};

export function getAppRootPath() {
  if (isEmpty(process.env.SESSION_DESKTOP_ROOT)) {
    throw new Error("You need to set the 'config.SESSION_DESKTOP_ROOT' in your .env file");
  }
  return process.env.SESSION_DESKTOP_ROOT as string;
}

function mockDbCreationTimestamp(dbCreationTimestampMs?: number) {
  if (dbCreationTimestampMs !== undefined) {
    process.env.DB_CREATION_TIMESTAMP_MS = String(dbCreationTimestampMs);
    const humanReadable = new Date(dbCreationTimestampMs).toLocaleString('en-AU');
    console.info(
      `   DB Creation Timestamp: ${process.env.DB_CREATION_TIMESTAMP_MS} (${humanReadable})`
    );
  } else {
    delete process.env.DB_CREATION_TIMESTAMP_MS;
  }
}

function mockNetworkPageNodeCount(networkPageNodeCount?: number) {
  if (networkPageNodeCount !== undefined) {
    if (networkPageNodeCount < 1 || networkPageNodeCount > 10) {
      throw new Error(`networkPageNodeCount must be between 1 and 10, got ${networkPageNodeCount}`);
    }
    process.env.SESSION_MOCK_NETWORK_PAGE_NODE_COUNT = String(networkPageNodeCount);
    console.info(`   Network Page Node Count: ${process.env.SESSION_MOCK_NETWORK_PAGE_NODE_COUNT}`);
  } else {
    delete process.env.SESSION_MOCK_NETWORK_PAGE_NODE_COUNT;
  }
}

function mockAvatarPickerFile(fakeAvatarPickerFile?: string) {
  if (fakeAvatarPickerFile) {
    process.env.SESSION_FAKE_AVATAR_PICKER_FILE = fakeAvatarPickerFile;
    console.info(`   Avatar picker file: ${fakeAvatarPickerFile}`);
  } else {
    delete process.env.SESSION_FAKE_AVATAR_PICKER_FILE;
  }
}

/**
 * Point Desktop at the local file server, if the run has one.
 *
 * Without this the client uploads to the PRODUCTION file server over an onion path — minutes per
 * avatar, and a spec that looks like it never clicked Save.
 *
 * Two keys, and they are not interchangeable: `FILE_SERVER_PUBKEY` is the X25519 key the mobile
 * clients need for onion encryption, while Desktop needs the **Ed25519** one, which it embeds in the
 * returned URL so the download leg can re-derive X25519 from it. Both are 64 hex characters, so
 * passing the wrong one fails no format check and breaks downloads rather than uploads.
 */
function useLocalFileServer() {
  const url = process.env.FILE_SERVER_URL?.trim();
  const edPubkey = process.env.FILE_SERVER_ED_PUBKEY?.trim();
  if (url && edPubkey) {
    process.env.TEST_FILE_SERVER_URL = url;
    process.env.TEST_FILE_SERVER_ED_PK = edPubkey;
    console.info(`   File server: ${url}`);
  } else {
    delete process.env.TEST_FILE_SERVER_URL;
    delete process.env.TEST_FILE_SERVER_ED_PK;
  }
}

const openElectronAppOnly = async (
  multi: string,
  context?: TestContext,
  nodeAppInstance?: string
) => {
  process.env.MULTI = `${multi}`;
  // using a v4 uuid, as timestamps to the ms are sometimes the same (when a bunch of workers are started)
  const fullUniqueId = randomUUID();
  const uniqueId = fullUniqueId.slice(0, 8);
  process.env.NODE_APP_INSTANCE =
    nodeAppInstance ?? `${MULTI_PREFIX}-devprod-${uniqueId}-${process.env.MULTI}`;
  process.env.NODE_ENV = NODE_ENV;

  // Inject custom env vars if provided
  mockDbCreationTimestamp(context?.dbCreationTimestampMs);
  mockNetworkPageNodeCount(context?.networkPageNodeCount);
  applyProMocks(context?.pro);
  mockAvatarPickerFile(context?.fakeAvatarPickerFile);
  useLocalFileServer();

  console.info(`   LOCAL_DEVNET_SEED_URL: ${process.env.LOCAL_DEVNET_SEED_URL}`);
  console.info(`   NON CI RUN`);
  console.info('   NODE_ENV', process.env.NODE_ENV);
  console.info('   NODE_APP_INSTANCE', process.env.NODE_APP_INSTANCE);

  try {
    const start = Date.now();
    const useXvfb = process.env.USE_XVFB === '1';
    // Playwright must launch a real Electron process. If ELECTRON_RUN_AS_NODE is inherited
    // (IDE-integrated terminals commonly set it), Electron runs as plain Node and rejects
    // Chromium flags like --no-sandbox, failing with "Process failed to launch!".
    const parentEnv = { ...process.env };
    delete parentEnv.ELECTRON_RUN_AS_NODE;
    const electronApp = await electron.launch({
      args: [
        join(getAppRootPath(), 'app', 'ts', 'mains', 'main_node.js'),
        '--disable-gpu',
        '--force-device-scale-factor=1', // Normalizes Retina and non-Retina mac screens
        ...(useXvfb ? ['--ozone-platform=x11'] : []),
      ],
      env: {
        ...parentEnv,
        ELECTRON_ENABLE_LOGGING: '1',
        // Optional: control log level
        ELECTRON_LOG_LEVEL: 'verbose', // 'verbose', 'info', 'warn', 'error'
        ...(useXvfb && { WAYLAND_DISPLAY: '' }),
        // Per-WINDOW Pro backend signing key, overriding the run-wide environment.
        //
        // The key is what libSession verifies proofs against, so pointing ONE window at a key the
        // backend never signed with is how a spec expresses a recipient that cannot verify a genuine
        // proof. Env rather than a launch arg because that is where the app already reads it from, and
        // each window is launched with its own env — so this needs no app change.
        ...(context?.pro?.proBackendPubkey
          ? { TEST_PRO_BACKEND_ED_PK: context.pro.proBackendPubkey }
          : {}),
      },
    });
    console.info(`  Electron app launched in ${Date.now() - start}ms`);

    if (logNodeConsole) {
      electronApp.on('console', msg => {
        const text = msg.text();
        console.log(`[FROM NODE ${msg.type()}]:`, text);
      });
    }

    // When a test closes a window on purpose,
    // the restarted app is considered a child process of the original electronApp.
    // However Playwright only tracks the original processes.
    // In order to close all Electron windows during teardown
    // we need to keep track of the opened PIDs.
    const pid = electronApp.process()?.pid;
    if (pid) {
      electronPids.push(pid);
    }
    if (!nodeAppInstance) {
      launchedInstances.push(process.env.NODE_APP_INSTANCE);
    }
    if (pid) {
      pidByInstance.set(process.env.NODE_APP_INSTANCE, pid);
    }

    return electronApp;
  } catch (e) {
    console.info(`failed to start electron app with error: ${(e as Error).message}`, e);
    throw e;
  }
};

const logBrowserConsole = process.env.LOG_BROWSER_CONSOLE === '1';

export async function waitFirstWindow(electronApp: ElectronApplication): Promise<Page> {
  // Get the first window that the app opens, wait if necessary.
  const start = Date.now();
  const window = await electronApp.firstWindow();
  console.info(`  Browser window opened in ${Date.now() - start}ms`);
  window.on('console', msg => {
    if (!logBrowserConsole) {
      return;
    }
    if (msg.type() === 'error') {
      console.log(`FROM BROWSER: Error "${msg.text()}"`);
    } else {
      console.log(`FROM BROWSER: ${msg.text()}`);
    }
  });
  return window;
}

export async function openApps(windowsToCreate: number, context?: TestContext) {
  if (windowsToCreate >= multisAvailable.length) {
    throw new Error(`Do you really need ${multisAvailable.length} windows?!`);
  }
  // if windowToCreate = 3, this array will be ABC. If windowToCreate = 5, this array will be ABCDE
  const multisToUse = multisAvailable.slice(0, windowsToCreate);

  const array = [...multisToUse];
  const apps = [];
  // not too sure why, but launching those windows with Promise.all triggers a sqlite error...
  for (let index = 0; index < array.length; index++) {
    const multi = array[index];

    const electronApp = await openElectronAppOnly(multi, context);

    apps.push(electronApp);
  }
  console.log(`Pathway to app: `, process.env.SESSION_DESKTOP_ROOT);
  return apps;
}

export async function openAppsAndWaitWindows(windowsToCreate: number, context?: TestContext) {
  const apps = await openApps(windowsToCreate, context);

  const windows = await Promise.all(apps.map(app => waitFirstWindow(app)));
  return windows;
}

export function getTrackedElectronPids(): Array<number> {
  return electronPids;
}

export function resetTrackedElectronPids() {
  electronPids = [];
  launchedInstances = [];
}

/** The `NODE_APP_INSTANCE` of each window opened this test, in the order `openApps` created them. */
export function getLaunchedInstances(): Array<string> {
  return launchedInstances;
}

/**
 * Bring a window back up on the same user-data directory it was using.
 *
 * Session Desktop asks the Pro backend for status once, at startup, so a grant made while the app is
 * running is invisible until it restarts — the same reason the mobile specs call
 * `forceStopAndRestart`. The relaunched process is pid-tracked like any other, so teardown kills it.
 */
export async function relaunchApp(multi: string, nodeAppInstance: string, context?: TestContext) {
  // The old process must die before the new one starts: Electron's single-instance lock is held on
  // the user-data directory, so a second launch against the same NODE_APP_INSTANCE exits immediately
  // instead of opening a window — which surfaces as `firstWindow` timing out, not as a launch error.
  const previousPid = pidByInstance.get(nodeAppInstance);
  if (previousPid) {
    try {
      execSync(
        process.platform === 'win32'
          ? `taskkill /F /T /PID ${previousPid}`
          : `pkill -9 -P ${previousPid}; kill -9 ${previousPid}`,
        { stdio: 'ignore' }
      );
    } catch (_e) {
      // Already gone — the window close may have taken the process with it.
    }
    // The lock is released when the process is reaped, not when the signal is sent.
    await sleepFor(1_000);
  }
  return openElectronAppOnly(multi, context, nodeAppInstance);
}

export function isRunningOnDevNet() {
  return !!process.env.LOCAL_DEVNET_SEED_URL;
}
