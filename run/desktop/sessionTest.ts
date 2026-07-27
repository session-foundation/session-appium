/* eslint-disable no-empty-pattern */

// Desktop test-declaration helpers. Adapted from session-playwright
// (tests/automation/setup/sessionTest.ts) to drive the app through `DesktopWrapper`
// instances (which implement IBaseDeviceWrapper) rather than raw Playwright `Page`s.
//
// Each builder opens the required Electron windows, wraps each in a DesktopWrapper,
// (for the account variants) onboards/links users, optionally creates a group, runs the
// callback, then force-closes every window in a `finally`. Window/process lifecycle is
// owned here — the wrapper never launches or kills Electron.
//
// Naming in the callback: a `DesktopWrapper` IS a window signed into an account. Where
// session-playwright passed a separate `alice: User` + `aliceWindow1: Page`, we pass a
// single `alice: DesktopWrapper` (use `alice.userName` / `alice.accountId` / `alice.getUser()`).
// A user's second window is `alice2`.

import { Page, test, TestInfo } from '@playwright/test';

import type { Group } from './types';

import { forceCloseAllWindows } from './closeWindows';
import { createGroup } from './create_group';
import { DesktopWrapper } from './DesktopWrapper';
import { linkedDevice } from './linked_device';
import { openApps, resetTrackedElectronPids, TestContext, waitFirstWindow } from './open';

const MAIN_IDENTITIES = ['alice-desktop', 'bob-desktop', 'charlie-desktop', 'dracula-desktop'];
const USER_NAMES = ['Alice', 'Bob', 'Charlie', 'Dracula'];

// ---------------------------------------------------------------------------
// Low-level: open N windows, NO accounts. For onboarding / pre-account tests.
// ---------------------------------------------------------------------------

async function openWrappedWindows(
  count: 1 | 2 | 3,
  context: TestContext | undefined,
  run: (wrappers: DesktopWrapper[], testInfo: TestInfo) => Promise<void>,
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
    const wrappers = pages.map((page, i) => new DesktopWrapper(page, MAIN_IDENTITIES[i]));
    await run(wrappers, testInfo);
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
      (w, info) => testCallback([w[0]], info),
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
      (w, info) => testCallback([w[0], w[1]], info),
      testName,
      testInfo
    );
  });
}

export function sessionTestThreeWindows(
  testName: string,
  testCallback: (
    windows: [DesktopWrapper, DesktopWrapper, DesktopWrapper],
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return test(testName, async ({}, testInfo) => {
    await openWrappedWindows(
      3,
      context,
      (w, info) => testCallback([w[0], w[1], w[2]], info),
      testName,
      testInfo
    );
  });
}

// ---------------------------------------------------------------------------
// Generic: open N accounts, optionally link second windows and/or create a group.
// ---------------------------------------------------------------------------

type GenericOptions = {
  /** 1-based user indices that get a linked second window. */
  links?: number[];
  /** 1-based user indices [a,b,c] to form a group. */
  grouped?: [number, number, number];
  waitForNetwork?: boolean;
  context?: TestContext;
};

type GenericDetails = {
  main: DesktopWrapper[];
  linked: DesktopWrapper[];
  groupCreated?: Group;
};

function sessionTestGeneric(
  testName: string,
  userCount: 1 | 2 | 3 | 4,
  { links, grouped, waitForNetwork = true, context }: GenericOptions,
  testCallback: (details: GenericDetails, testInfo: TestInfo) => Promise<void>
) {
  return test(testName, async ({}, testInfo) => {
    resetTrackedElectronPids();
    const apps = await openApps(userCount, context);
    const mainPages = await Promise.all(apps.map(app => waitFirstWindow(app)));
    const linkedPages: Page[] = [];

    try {
      if (mainPages.length !== userCount) {
        throw new Error(`openApps should have opened ${userCount} windows but did not.`);
      }
      const main = mainPages.map((page, i) => new DesktopWrapper(page, MAIN_IDENTITIES[i]));
      await Promise.all(main.map((w, i) => w.onboard(USER_NAMES[i], waitForNetwork)));

      const linked: DesktopWrapper[] = [];
      if (links?.length) {
        for (const link of links) {
          const owner = main[link - 1];
          const page = await linkedDevice(owner.getUser().recoveryPassword);
          linkedPages.push(page);
          const wrapper = new DesktopWrapper(page, `${MAIN_IDENTITIES[link - 1]}-2`);
          wrapper.setAccount(owner.getUser());
          linked.push(wrapper);
        }
      }

      let groupCreated: Group | undefined;
      if (grouped?.length) {
        const [a, b, c] = grouped;
        groupCreated = await createGroup(
          testName,
          main[a - 1].getUser(),
          main[a - 1].getPage(),
          main[b - 1].getUser(),
          main[b - 1].getPage(),
          main[c - 1].getUser(),
          main[c - 1].getPage()
        );
      }

      await testCallback({ main, linked, groupCreated }, testInfo);
    } finally {
      try {
        await forceCloseAllWindows([...mainPages, ...linkedPages]);
      } catch (e) {
        console.error(`forceCloseAllWindows of ${testName} failed with: `, e);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Named builders (mirror session-playwright's, but callbacks receive wrappers).
// ---------------------------------------------------------------------------

export function test_Alice_1W(
  testName: string,
  testCallback: (details: { alice: DesktopWrapper }, testInfo: TestInfo) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(testName, 1, { context }, ({ main }, info) =>
    testCallback({ alice: main[0] }, info)
  );
}

/** 1 user, 1 window, network NOT awaited (password/settings-only tests). */
export function test_Alice_1W_no_network(
  testName: string,
  testCallback: (details: { alice: DesktopWrapper }, testInfo: TestInfo) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(testName, 1, { waitForNetwork: false, context }, ({ main }, info) =>
    testCallback({ alice: main[0] }, info)
  );
}

/** Alice with two windows (second is a linked device). */
export function test_Alice_2W(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; alice2: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(testName, 1, { links: [1], context }, ({ main, linked }, info) =>
    testCallback({ alice: main[0], alice2: linked[0] }, info)
  );
}

export function test_Alice_1W_Bob_1W(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; bob: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(testName, 2, { context }, ({ main }, info) =>
    testCallback({ alice: main[0], bob: main[1] }, info)
  );
}

export function test_Alice_2W_Bob_1W(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; alice2: DesktopWrapper; bob: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(testName, 2, { links: [1], context }, ({ main, linked }, info) =>
    testCallback({ alice: main[0], alice2: linked[0], bob: main[1] }, info)
  );
}

export function test_group_Alice_1W_Bob_1W_Charlie_1W(
  testName: string,
  testCallback: (
    details: {
      alice: DesktopWrapper;
      bob: DesktopWrapper;
      charlie: DesktopWrapper;
      groupCreated: Group;
    },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(
    testName,
    3,
    { grouped: [1, 2, 3], context },
    ({ main, groupCreated }, info) =>
      testCallback(
        { alice: main[0], bob: main[1], charlie: main[2], groupCreated: groupCreated as Group },
        info
      )
  );
}

export function test_group_Alice_2W_Bob_1W_Charlie_1W(
  testName: string,
  testCallback: (
    details: {
      alice: DesktopWrapper;
      alice2: DesktopWrapper;
      bob: DesktopWrapper;
      charlie: DesktopWrapper;
      groupCreated: Group;
    },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(
    testName,
    3,
    { grouped: [1, 2, 3], links: [1], context },
    ({ main, linked, groupCreated }, info) =>
      testCallback(
        {
          alice: main[0],
          alice2: linked[0],
          bob: main[1],
          charlie: main[2],
          groupCreated: groupCreated as Group,
        },
        info
      )
  );
}

export function test_group_Alice_1W_Bob_1W_Charlie_1W_Dracula_1W(
  testName: string,
  testCallback: (
    details: {
      alice: DesktopWrapper;
      bob: DesktopWrapper;
      charlie: DesktopWrapper;
      dracula: DesktopWrapper;
      groupCreated: Group;
    },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestGeneric(
    testName,
    4,
    { grouped: [1, 2, 3], context },
    ({ main, groupCreated }, info) =>
      testCallback(
        {
          alice: main[0],
          bob: main[1],
          charlie: main[2],
          dracula: main[3],
          groupCreated: groupCreated as Group,
        },
        info
      )
  );
}
