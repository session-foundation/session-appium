// Desktop-only counterpart to the mobile `run/test/state_builder` and the multi-platform
// `run/test/utils/cross_platform_state`: seed accounts (and their friendships/groups) onto the
// swarm with the qa-seeder, open the Electron windows, and restore each window from its account's
// recovery phrase — so a test never pays for UI onboarding, UI contact creation or UI group
// creation just to reach its starting state.
//
// This deliberately does NOT reuse `openAppsWithStateCrossPlatform`: that module pulls in the
// Appium capability builders and drivers, which desktop-only runs (typically on Linux, with no
// iOS/Android config in `.env`) have no reason to load.
//
// Lifecycle: this only spawns windows. The caller owns teardown — it must call
// `resetTrackedElectronPids()` before and `forceCloseAllWindows()` after, which also kills windows
// that opened before a failure here (Electron pids are tracked globally, so passing an empty page
// list is still enough to clean them up).

import type { Page } from '@playwright/test';

import {
  buildStateForTest,
  type BuildStateOptions,
  type PrebuiltStateKey,
  type StateGroup,
  type StateUser,
  type WithGroupStateKey,
} from '@session-foundation/qa-seeder';

import { resolveNetworkTarget } from '../test/utils/devnet';
import { DesktopWrapper } from './DesktopWrapper';
import {
  getLaunchedInstances,
  multisAvailable,
  openApps,
  type TestContext,
  waitFirstWindow,
} from './open';

/** One seeded account together with the windows signed into it. */
export type SeededUser = {
  account: StateUser;
  windows: DesktopWrapper[];
};

/**
 * Build `stateKey` with the qa-seeder, open `sum(windowsPerUser) + extraWindows` Electron windows,
 * and restore each seeded user's windows from their recovery phrase.
 *
 * `windowsPerUser` is index-aligned with the state's users (`'2friends'` → `[alice, bob]`), so
 * `[2, 1]` gives Alice two linked windows and Bob one.
 *
 * `extraWindows` are opened but left untouched at the onboarding screen — for the rare test that
 * needs an account the seeder cannot express (a 4th user, an externally-owned seed).
 *
 * `stateOptions` is the seeder's per-user knobs (Pro access, pinned conversations), addressed by a
 * user's index in the state's user list. They compose with every state key rather than each
 * combination needing a key of its own, which is why they are threaded through here instead of being
 * chosen by `stateKey`.
 */
export async function openSeededWindows<K extends PrebuiltStateKey>({
  stateKey,
  groupName,
  windowsPerUser,
  extraWindows = 0,
  context,
  stateOptions,
}: {
  stateKey: K;
  groupName: K extends WithGroupStateKey ? string : undefined;
  windowsPerUser: number[];
  extraWindows?: number;
  context?: TestContext;
  /// Seeded Pro access and pins, addressed by index into the state's user list.
  stateOptions?: BuildStateOptions;
}): Promise<{
  users: SeededUser[];
  /** Windows with no account on them, in the order requested. */
  extras: DesktopWrapper[];
  /** Every window opened, for the caller's `forceCloseAllWindows` teardown. */
  pages: Page[];
  group?: StateGroup;
}> {
  // Resolved before anything is opened or seeded: on a mismatch (or an unusable devnet) the seeder
  // would otherwise write the accounts onto one network while the app polls another, and the test
  // would hang to its timeout rather than failing with the reason.
  const network = await resolveNetworkTarget(['desktop']);

  const totalWindows = windowsPerUser.reduce((sum, n) => sum + n, 0) + extraWindows;

  // Seeding and window-opening are independent, so overlap them: seeding is several swarm writes
  // and opening is several Electron launches. `openApps` still launches its windows one at a time
  // (launching them in parallel trips a sqlite error).
  const [pages, prebuilt] = await Promise.all([
    openApps(totalWindows, context).then(apps =>
      Promise.all(apps.map(app => waitFirstWindow(app)))
    ),
    buildStateForTest(stateKey, groupName, network, stateOptions),
  ]);

  const seedUsers = (prebuilt as { users: StateUser[] }).users;
  if (windowsPerUser.length !== seedUsers.length) {
    throw new Error(
      `openSeededWindows: windowsPerUser has ${windowsPerUser.length} entries but state '${stateKey}' has ${seedUsers.length} users`
    );
  }

  // Positional, exactly as the onboarding templates do it: `openApps` launches windows one at a time
  // and records each, so a window's index in `pages` is its index here. Without this a seeded window
  // cannot be restarted — `restartApp` needs the multi and instance to come back up on the same
  // user-data directory, and it throws rather than guessing.
  const instances = getLaunchedInstances();
  const identify = (wrapper: DesktopWrapper, windowIndex: number) => {
    if (windowIndex >= multisAvailable.length || !instances[windowIndex]) {
      throw new Error(
        `openSeededWindows: window ${windowIndex + 1} has no launch identity to assign ` +
          `(${multisAvailable.length} multis, ${instances.length} instances recorded)`
      );
    }
    wrapper.setLaunchIdentity(multisAvailable[windowIndex], instances[windowIndex]);
  };

  let next = 0;
  const users: SeededUser[] = seedUsers.map((stateUser, i) => {
    const nameLc = stateUser.userName.toLowerCase();
    const windows = pages.slice(next, next + windowsPerUser[i]).map((page, w) => {
      const wrapper = new DesktopWrapper(page, `${nameLc}-desktop${w + 1}`);
      identify(wrapper, next + w);
      // Restoring from a seed does not tell the wrapper WHICH account it landed on, and specs read
      // `alice.userName` / `alice.sessionId` constantly — so hand it the seeded account up front.
      wrapper.setAccount(stateUser);
      return wrapper;
    });
    next += windowsPerUser[i];
    return { account: stateUser, windows };
  });

  const extras = pages.slice(next).map((page, i) => {
    const wrapper = new DesktopWrapper(page, `unassigned-desktop${i + 1}`);
    identify(wrapper, next + i);
    return wrapper;
  });

  await Promise.all(
    users.flatMap(u => u.windows.map(w => w.restoreFromSeed(u.account.seedPhrase)))
  );

  const group = 'group' in prebuilt ? prebuilt.group : undefined;

  return { users, extras, pages, group };
}
