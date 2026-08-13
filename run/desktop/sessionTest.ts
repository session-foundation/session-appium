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

import {
  allocateCommunityRooms,
  perTestRoomsEnabled,
  releaseCommunityRooms,
} from '../test/utils/community_rooms';
import { forceCloseAllWindows } from './closeWindows';
import { createGroup } from './create_group';
import { DesktopWrapper } from './DesktopWrapper';
import { linkedDevice } from './linked_device';
import {
  getLaunchedInstances,
  openApps,
  resetTrackedElectronPids,
  TestContext,
  waitFirstWindow,
} from './open';
import { openSeededWindows, type SeededUser } from './seeded_state';

const MAIN_IDENTITIES = ['alice-desktop', 'bob-desktop', 'charlie-desktop', 'dracula-desktop'];
const USER_NAMES = ['Alice', 'Bob', 'Charlie', 'Dracula'];
/** Mirrors `openApps`, which assigns multis from the start of the alphabet in launch order. */
const MULTIS = ['A', 'B', 'C', 'D'];

/**
 * Appends the `@pro` tag mobile's `sessionIt` generates, so `--grep @pro` selects the same class of
 * test on every platform.
 *
 * Derived from the context rather than declared per test, so it cannot disagree with what the spec
 * actually sets up — mobile's hand-written `isPro` can.
 */
function taggedName(testName: string, context?: TestContext) {
  return context?.pro ? `${testName} @pro` : testName;
}

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
    const instances = getLaunchedInstances();
    const wrappers = pages.map((page, i) => {
      const wrapper = new DesktopWrapper(page, MAIN_IDENTITIES[i]);
      wrapper.setLaunchIdentity(MULTIS[i], instances[i]);
      return wrapper;
    });
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
  return test(taggedName(testName, context), async ({}, testInfo) => {
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
  return test(taggedName(testName, context), async ({}, testInfo) => {
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
  return test(taggedName(testName, context), async ({}, testInfo) => {
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
  return test(taggedName(testName, context), async ({}, testInfo) => {
    resetTrackedElectronPids();

    if (context?.communityRooms && perTestRoomsEnabled()) {
      try {
        await allocateCommunityRooms(context.communityRooms);
      } catch (allocationError) {
        // Allocation sits outside the try below, so its `finally` — where rooms are released — is
        // not reached if allocation itself fails. A partly-completed allocation has still created
        // rooms, so release them here rather than leaving them for the gc TTL.
        await releaseCommunityRooms();
        throw allocationError;
      }
    }

    const apps = await openApps(userCount, context);
    const mainPages = await Promise.all(apps.map(app => waitFirstWindow(app)));
    const linkedPages: Page[] = [];

    try {
      if (mainPages.length !== userCount) {
        throw new Error(`openApps should have opened ${userCount} windows but did not.`);
      }
      const instances = getLaunchedInstances();
      const main = mainPages.map((page, i) => {
        const wrapper = new DesktopWrapper(page, MAIN_IDENTITIES[i]);
        // Positional: `openApps` launches multis A, B, C… in order and records each instance as it
        // goes, so index i here is the same window as index i there.
        wrapper.setLaunchIdentity(MULTIS[i], instances[i]);
        return wrapper;
      });
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
      await releaseCommunityRooms();
    }
  });
}

// ---------------------------------------------------------------------------
// Generic (seeded): accounts, friendships and groups come from the qa-seeder.
//
// Same contract as `sessionTestGeneric`, but nothing is built through the UI: the state is written
// straight onto the swarm and every window is restored from its account's seed. Use this whenever
// a relationship (friends / a group) is a test's *precondition*; keep the UI builders for the tests
// whose subject IS the creation flow (onboarding, create group, message requests).
// ---------------------------------------------------------------------------

type SeededOptions = {
  /** Windows per seeded user, index-aligned with the state's users (Alice, Bob, Charlie). */
  windowsPerUser: number[];
  /** Extra windows with no account, left at the onboarding screen. */
  extraWindows?: number;
  context?: TestContext;
};

/**
 * Prefix on the one message a seeded group is warmed up with (see `focusAndWarmSeededGroup`).
 *
 * Exported so a spec can tell the fixture's message from its own. Without it the warm-up read
 * `Alice to <group>` — byte-identical to what the UI `createGroup` used to send — so anything
 * matching loosely on message text could not exclude it.
 */
export const SEEDED_GROUP_WARM_UP_PREFIX = '[fixture warm-up]';

type SeededFriendsDetails = {
  users: SeededUser[];
  extras: DesktopWrapper[];
  /** Friend states have no group. Declared as `undefined` so the union discriminates on it. */
  group?: undefined;
};

type SeededGroupDetails = {
  users: SeededUser[];
  extras: DesktopWrapper[];
  group: Group;
};

/**
 * Open the 1:1 with the other seeded user on each user's FIRST window.
 *
 * Mirrors the UI equivalent (`createContact`), which exchanges a message each way and so leaves
 * exactly those two windows sitting in the conversation. Linked windows are deliberately left
 * where they are — specs open the conversation on them when they need it, and selecting it here
 * is not harmless: Desktop treats a *currently selected* private conversation as special when the
 * contact later disappears from the wrapper, which changes what a delete-syncs test observes.
 *
 * A linked window still gets the contact in its left pane with nothing opened, because the seeder
 * stamps the contact's `created` timestamp (qa-seeder > 0.2.0) and a client derives the
 * conversation's `active_at` from it. Without that stamp there is no `active_at`, and a
 * conversation with no `active_at` never reaches the conversation list at all.
 */
async function focusSeededFriendConvos(users: SeededUser[]) {
  if (users.length !== 2) {
    throw new Error(`focusSeededFriendConvos expects exactly 2 users, got ${users.length}`);
  }
  const [alice, bob] = users;
  await Promise.all([
    alice.windows[0].openConversationWith(bob.account.userName),
    bob.windows[0].openConversationWith(alice.account.userName),
  ]);
}

/**
 * Open the seeded group on each user's first window and prove it is LIVE there, by having the
 * admin send one message that every other member waits for.
 *
 * This is not politeness, it is the correctness step of a seeded group. A group's entry lands in
 * `user_groups` as soon as the account's own config merges — that is what puts it in the left pane
 * — but its keys/info/members configs live on the GROUP's swarm and merge on a later poll. A test
 * that acts on the group in that window acts on a group with no encryption keys, and the client
 * fails silently rather than loudly: `deleteGroup` skips sending the leave message entirely when
 * `MetaGroupWrapperActions.keyGetAll()` is empty, so "Leave group" removed the conversation
 * locally and the other members were never told.
 *
 * `createGroup` never had this problem because it ends by sending a message from every member and
 * verifying it everywhere. One message from the admin is the cheap equivalent: the send waits for
 * a 'sent' tick (so the admin has keys) and each receiver decrypting it proves the same for them.
 *
 * So every seeded group starts with EXACTLY ONE message in it — the admin's, carrying
 * `SEEDED_GROUP_WARM_UP_PREFIX` so a spec can filter it out.
 */
async function focusAndWarmSeededGroup(users: SeededUser[], groupName: string) {
  const firstWindows = users.map(u => u.windows[0]);
  await Promise.all(firstWindows.map(w => w.openConversationWith(groupName)));

  const [admin, ...members] = firstWindows;
  const warmUpMessage = `${SEEDED_GROUP_WARM_UP_PREFIX} ${users[0].account.userName} to ${groupName}`;
  await admin.sendMessage(warmUpMessage);
  await Promise.all(members.map(w => w.waitForTextMessage(warmUpMessage, 30_000)));
}

/**
 * Shared lifecycle for every seeded builder: reset the tracked Electron pids, run the body, and
 * force-close whatever it opened. The body pushes its pages onto `pages` as soon as it has them,
 * so a failure part-way through `openSeededWindows` still gets cleaned up.
 */
function seededTest(
  testName: string,
  body: (pages: Page[], testInfo: TestInfo) => Promise<void>
): void {
  return test(testName, async ({}, testInfo) => {
    resetTrackedElectronPids();
    const pages: Page[] = [];

    try {
      await body(pages, testInfo);
    } finally {
      try {
        // Called even with no page: Electron pids are tracked globally (reset above), so windows
        // that opened before a failure in `openSeededWindows` are only reachable this way.
        await forceCloseAllWindows(pages);
      } catch (e) {
        console.error(`forceCloseAllWindows of ${testName} failed with: `, e);
      }
    }
  });
}

/**
 * One entry point per state rather than one taking a state-key union.
 *
 * The union forced two casts that this shape removes by construction: `groupName`'s type in
 * `openSeededWindows` is conditional on the state key, so a union key collapsed it to `never`;
 * and a single `SeededDetails` with an optional `group` made every group builder assert
 * `group as Group`. Here each opener passes a literal key and each callback gets exactly the
 * details its state produces — `3friendsInGroup` requires a group name and yields a required
 * `group`, `2friends` takes no group name and yields none.
 *
 * (Overloads over one implementation cannot express this without `any`: the implementation's
 * callback would take the union, and function parameters are contravariant under
 * `strictFunctionTypes`, so neither narrow overload is assignable to it.)
 */
function sessionTestSeededFriends(
  testName: string,
  { windowsPerUser, extraWindows = 0, context }: SeededOptions,
  testCallback: (details: SeededFriendsDetails, testInfo: TestInfo) => Promise<void>
): void {
  return seededTest(testName, async (pages, testInfo) => {
    const opened = await openSeededWindows({
      stateKey: '2friends',
      groupName: undefined,
      windowsPerUser,
      extraWindows,
      context,
    });
    pages.push(...opened.pages);

    await focusSeededFriendConvos(opened.users);
    await testCallback({ users: opened.users, extras: opened.extras }, testInfo);
  });
}

function sessionTestSeededGroup(
  testName: string,
  { windowsPerUser, extraWindows = 0, context }: SeededOptions,
  testCallback: (details: SeededGroupDetails, testInfo: TestInfo) => Promise<void>
): void {
  return seededTest(testName, async (pages, testInfo) => {
    const opened = await openSeededWindows({
      stateKey: '3friendsInGroup',
      // Same convention as the UI builder: the group is named after the test.
      groupName: testName,
      windowsPerUser,
      extraWindows,
      context,
    });
    pages.push(...opened.pages);

    if (!opened.group) {
      throw new Error(`state '3friendsInGroup' returned no group`);
    }
    const group: Group = {
      userName: opened.group.groupName,
      userOne: opened.users[0].account,
      userTwo: opened.users[1].account,
      userThree: opened.users[2].account,
    };
    // Mirror `createGroup`, which leaves the group open on each user's first window only —
    // specs open it on linked windows themselves.
    await focusAndWarmSeededGroup(opened.users, group.userName);
    await testCallback({ users: opened.users, extras: opened.extras, group }, testInfo);
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

/**
 * Alice and Bob, already mutual contacts (qa-seeder `2friends`), each with the 1:1 open.
 *
 * The seeded counterpart of `test_Alice_1W_Bob_1W` + `alice.createContactWith(bob)`. Note the
 * conversation starts EMPTY — seeding approves the contact on both sides but exchanges no
 * messages, unlike `createContactWith`.
 */
export function test_Alice_1W_Bob_1W_friends(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; bob: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestSeededFriends(
    testName,
    { windowsPerUser: [1, 1], context },
    ({ users }, info) =>
      testCallback({ alice: users[0].windows[0], bob: users[1].windows[0] }, info)
  );
}

/** As `test_Alice_1W_Bob_1W_friends`, with a second (linked) window for Alice. */
export function test_Alice_2W_Bob_1W_friends(
  testName: string,
  testCallback: (
    details: { alice: DesktopWrapper; alice2: DesktopWrapper; bob: DesktopWrapper },
    testInfo: TestInfo
  ) => Promise<void>,
  context?: TestContext
) {
  return sessionTestSeededFriends(
    testName,
    { windowsPerUser: [2, 1], context },
    ({ users }, info) =>
      testCallback(
        { alice: users[0].windows[0], alice2: users[0].windows[1], bob: users[1].windows[0] },
        info
      )
  );
}

/**
 * Alice (admin), Bob and Charlie, mutual friends already in a group (qa-seeder
 * `3friendsInGroup`, named after the test), with the group open on each user's window.
 *
 * The group is SEEDED, not created through the UI: `createGroup` costs six 1:1 messages, the
 * create-group flow and a message from every member verified on every window, all of it setup for
 * tests whose subject is something else. `group_testing.spec.ts`'s "Create group" keeps driving
 * the real flow.
 *
 * As with `createGroup`, Alice is the group's admin. Unlike it, the group has no `groupMemberNew`
 * update messages in it and starts with exactly ONE message — the admin's warm-up, prefixed with
 * `SEEDED_GROUP_WARM_UP_PREFIX` so a spec can exclude it. See `focusAndWarmSeededGroup` for why it
 * has to be sent at all.
 */
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
  return sessionTestSeededGroup(
    testName,
    { windowsPerUser: [1, 1, 1], context },
    ({ users, group }, info) =>
      testCallback(
        {
          alice: users[0].windows[0],
          bob: users[1].windows[0],
          charlie: users[2].windows[0],
          groupCreated: group,
        },
        info
      )
  );
}

/** As `test_group_Alice_1W_Bob_1W_Charlie_1W`, with a second (linked) window for Alice. */
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
  return sessionTestSeededGroup(
    testName,
    { windowsPerUser: [2, 1, 1], context },
    ({ users, group }, info) =>
      testCallback(
        {
          alice: users[0].windows[0],
          alice2: users[0].windows[1],
          bob: users[1].windows[0],
          charlie: users[2].windows[0],
          groupCreated: group,
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
  // Hybrid: the seeder tops out at three users, so the group (Alice/Bob/Charlie) is seeded while
  // Dracula — the outsider this fixture exists to add — is still onboarded through the UI.
  return sessionTestSeededGroup(
    testName,
    { windowsPerUser: [1, 1, 1], extraWindows: 1, context },
    async ({ users, extras, group }, info) => {
      const dracula = extras[0];
      await dracula.onboard('Dracula');
      return testCallback(
        {
          alice: users[0].windows[0],
          bob: users[1].windows[0],
          charlie: users[2].windows[0],
          dracula,
          groupCreated: group,
        },
        info
      );
    }
  );
}
