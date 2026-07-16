// Copied from session-playwright (tests/automation/setup/open.ts).
// Changes for this repo: `chalk` colouring removed (avoids an ESM-only dep in a
// CJS project) and catch-clause error access cast for the stricter tsconfig.
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { isEmpty } from 'lodash';
import { join } from 'path';
import { v4 } from 'uuid';

const logNodeConsole = process.env.LOG_NODE_CONSOLE === '1';

export const NODE_ENV = 'production';
export const MULTI_PREFIX = 'test-integration';
const multisAvailable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let electronPids: Array<number> = [];

export type TestContext = {
  dbCreationTimestampMs?: number;
  networkPageNodeCount?: number;
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

const openElectronAppOnly = async (multi: string, context?: TestContext) => {
  process.env.MULTI = `${multi}`;
  // using a v4 uuid, as timestamps to the ms are sometimes the same (when a bunch of workers are started)
  const fullUniqueId = v4();
  const uniqueId = fullUniqueId.slice(0, 8);
  process.env.NODE_APP_INSTANCE = `${MULTI_PREFIX}-devprod-${uniqueId}-${process.env.MULTI}`;
  process.env.NODE_ENV = NODE_ENV;

  // Inject custom env vars if provided
  mockDbCreationTimestamp(context?.dbCreationTimestampMs);
  mockNetworkPageNodeCount(context?.networkPageNodeCount);

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
}

export function isRunningOnDevNet() {
  return !!process.env.LOCAL_DEVNET_SEED_URL;
}
