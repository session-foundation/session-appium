/* eslint-disable no-empty-pattern */

// Desktop test-declaration helpers. Adapted from session-playwright
// (tests/automation/setup/sessionTest.ts) to drive the app through `DesktopWrapper`
// instances (which implement IBaseDeviceWrapper) rather than raw Playwright `Page`s.
//
// Each builder opens the required number of Electron windows, wraps each in a
// DesktopWrapper, (for the account variants) onboards a user per window, runs the
// callback, then force-closes every window in a `finally`. Window/process lifecycle is
// owned here — the wrapper never launches or kills Electron.

import { Page, test, TestInfo } from '@playwright/test';

import { forceCloseAllWindows } from './closeWindows';
import { DesktopWrapper } from './DesktopWrapper';
import { openApps, resetTrackedElectronPids, TestContext, waitFirstWindow } from './open';

type CountWindows = 1 | 2 | 3;

const identities = ['alice-desktop', 'bob-desktop', 'charlie-desktop'] as const;

/**
 * Open `count` Electron windows, wrap each in a DesktopWrapper, run `testCallback`,
 * then force-close every window. No accounts are created — use this for onboarding /
 * pre-account tests, or onboard manually inside the callback.
 */
async function openWrappedWindows(
  count: CountWindows,
  context: TestContext | undefined,
  run: (wrappers: DesktopWrapper[], pages: Page[], testInfo: TestInfo) => Promise<void>,
  testName: string,
  testInfo: TestInfo
) {
  resetTrackedElectronPids();
  const apps = await openApps(count, context);
  const pages = await Promise.all(apps.map(app => waitFirstWindow(app)));
  try {
    if (pages.length !== count) {
      throw new Error(`openApps should have opened ${count} windows but did not.`);
    }
    const wrappers = pages.map((page, i) => new DesktopWrapper(page, identities[i]));
    await run(wrappers, pages, testInfo);
  } finally {
    try {
      await forceCloseAllWindows(pages);
    } catch (e) {
      console.error(`forceCloseAllWindows of ${testName} failed with: `, e);
    }
  }
}

export function sessionTestOneWindow(
  testName: string,
  testCallback: (windows: [DesktopWrapper], testInfo: TestInfo) => Promise<void>,
  context?: TestContext
) {
  return test(testName, async ({}, testInfo) => {
    await openWrappedWindows(
      1,
      context,
      (w, _pages, info) => testCallback([w[0]], info),
      testName,
      testInfo
    );
  });
}

export function sessionTestTwoWindows(
  testName: string,
  testCallback: (windows: [DesktopWrapper, DesktopWrapper], testInfo: TestInfo) => Promise<void>,
  context?: TestContext
) {
  return test(testName, async ({}, testInfo) => {
    await openWrappedWindows(
      2,
      context,
      (w, _pages, info) => testCallback([w[0], w[1]], info),
      testName,
      testInfo
    );
  });
}

/**
 * Setup the test with 2 users and 2 windows total:
 * - Alice with 1 window,
 * - Bob with 1 window.
 * Both accounts are onboarded before the callback runs.
 */
export function test_Alice_1W_Bob_1W(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; bob: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return test(testName, async ({}, testInfo) => {
    await openWrappedWindows(
      2,
      context,
      async ([alice, bob], _pages, info) => {
        await Promise.all([alice.onboard('Alice'), bob.onboard('Bob')]);
        await testCallback({ alice, bob }, info);
      },
      testName,
      testInfo
    );
  });
}
