import type { Page, TestInfo } from '@playwright/test';

import {
  buildStateForTest,
  type PrebuiltState,
  type PrebuiltStateKey,
  type StateUser,
  type WithGroupStateKey,
} from '@session-foundation/qa-seeder';

import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';
import type { ClientPlatform } from '../../types/target';

import { forceCloseAllWindows } from '../../desktop/closeWindows';
import { DesktopWrapper } from '../../desktop/DesktopWrapper';
import {
  getLaunchedInstances,
  multisAvailable,
  openApps,
  type TestContext,
  waitFirstWindow,
} from '../../desktop/open';
import { getDevicesPerTestCount } from './binaries';
import { getAndroidPoolSize } from './capabilities_android';
import { resolveNetworkTarget } from './devnet';
import { closeApp, openAppMultipleDevices } from './open_app';
import { PRO_BACKEND_CONTEXT } from './pro_context';

/**
 * How many clients of each platform a single account should have. Defined here (the leaf) and
 * re-exported by `cross_platform.ts` as `CrossPlatformSetup`, which is the name specs use.
 */
export type PerUserPlatforms = {
  android?: number;
  ios?: number;
  desktop?: number;
};

/** One account together with the clients (across platforms) linked to it. */
export type UserClients = {
  account: StateUser;
  android: DeviceWrapper[];
  ios: DeviceWrapper[];
  desktop: DesktopWrapper[];
  /** Every client of this account, ordered android → ios → desktop. */
  all: IBaseDeviceWrapper[];
};

/**
 * Fail before the (slow) seeding step if this test asks for more mobile clients than the machine
 * has. Without it the run pays for a full `buildStateForTest` and then dies one device at a time
 * inside the opener, which is a much worse signal.
 *
 * Desktop is uncapped: each window gets its own `NODE_APP_INSTANCE`, so there is no pool.
 */
function assertPoolsCanFit(totalAndroid: number, totalIos: number): void {
  const devicesPerWorker = getDevicesPerTestCount();
  if (totalIos > devicesPerWorker) {
    throw new Error(
      `This test needs ${totalIos} iOS simulator(s), but each worker is allocated only ` +
        `${devicesPerWorker} (DEVICES_PER_TEST_COUNT=${devicesPerWorker}). Re-run with a larger ` +
        `pool, e.g. \`pnpm test-ios-parallel --devices ${totalIos}\`.`
    );
  }
  const androidPoolSize = getAndroidPoolSize();
  if (totalAndroid > androidPoolSize) {
    throw new Error(
      `This test needs ${totalAndroid} Android emulator(s), but the harness only knows about ` +
        `${androidPoolSize} (see the udid list in capabilities_android.ts).`
    );
  }
}

/**
 * One opener rejected: close whatever its siblings managed to open, so a half-open test doesn't
 * leave live Appium sessions (which hold their simulator/emulator) or Electron processes behind.
 * Cleanup failures are logged, never thrown — the original opener error is the one worth surfacing.
 */
async function closePartiallyOpenedClients(
  mobile: DeviceWrapper[],
  desktopWindows: Page[]
): Promise<void> {
  if (mobile.length > 0) {
    try {
      await closeApp(...mobile);
    } catch (e) {
      console.error('Failed to close mobile sessions after a failed cross-platform open:', e);
    }
  }
  // Called even with no page: Electron pids are tracked globally (the caller resets them before
  // opening), so a window that launched but never yielded a page is only reachable this way.
  try {
    await forceCloseAllWindows(desktopWindows);
  } catch (e) {
    console.error('forceCloseAllWindows failed after a failed cross-platform open:', e);
  }
}

/**
 * Cross-platform, multi-account counterpart to the mobile `openAppsWithState`
 * (`run/test/state_builder`): seed the requested users/relationships onto the swarm
 * with the qa-seeder, open the requested clients ACROSS platforms (Android/iOS via
 * Appium, Desktop via Electron), and restore each client from its account's seed.
 *
 * `perUser` is index-aligned with the state's users (e.g. `'2friends'` → `[alice, bob]`),
 * so `perUser[0]` describes Alice's devices and `perUser[1]` Bob's.
 *
 * Lifecycle: this only spawns clients. The caller owns teardown — for Electron it must
 * have called `resetTrackedElectronPids()` beforehand and must `forceCloseAllWindows()`
 * the returned `desktopWindows` afterwards (mobile sessions are auto-registered for the
 * test's failure-artifact + cleanup handling by `openAppMultipleDevices`).
 */
export async function openAppsWithStateCrossPlatform<K extends PrebuiltStateKey>({
  stateToBuildKey,
  groupName,
  perUser,
  testInfo,
  isPro = false,
  fakeAvatarPickerFile,
}: {
  stateToBuildKey: K;
  groupName: K extends WithGroupStateKey ? string : undefined;
  perUser: PerUserPlatforms[];
  testInfo: TestInfo;
  isPro?: boolean;
  /** Absolute path handed to every desktop window's test-integration avatar picker. */
  fakeAvatarPickerFile?: string;
}): Promise<{
  prebuilt: PrebuiltState[K];
  users: UserClients[];
  /** Every Electron window opened, for the caller's `forceCloseAllWindows` teardown. */
  desktopWindows: Page[];
  /** Flat list of every client across all accounts (for teardown / iteration). */
  allClients: IBaseDeviceWrapper[];
}> {
  const totalAndroid = perUser.reduce((sum, u) => sum + (u.android ?? 0), 0);
  const totalIos = perUser.reduce((sum, u) => sum + (u.ios ?? 0), 0);
  const totalDesktop = perUser.reduce((sum, u) => sum + (u.desktop ?? 0), 0);

  // Every platform in this test must be on the SAME Session network, or the seeder writes the
  // account onto one network while a client polls another and the test hangs until it times out.
  // Each platform resolves its network from a different source, so cross-check them all up front
  // (before the slow seeding step) and use the agreed network for the seeder.
  const present: ClientPlatform[] = [];
  if (totalAndroid > 0) {
    present.push('android');
  }
  if (totalIos > 0) {
    present.push('ios');
  }
  if (totalDesktop > 0) {
    present.push('desktop');
  }
  assertPoolsCanFit(totalAndroid, totalIos);

  const net = await resolveNetworkTarget(present);
  const prebuilt = await buildStateForTest(stateToBuildKey, groupName, net);
  const seedUsers = (prebuilt as { users: StateUser[] }).users;

  if (perUser.length !== seedUsers.length) {
    throw new Error(
      `openAppsWithStateCrossPlatform: perUser has ${perUser.length} entries but state '${stateToBuildKey}' has ${seedUsers.length} users`
    );
  }

  // `{ pro: {} }` rather than nothing when this run is Pro: an empty context asks for "nothing
  // mocked", which is what a real grant needs — the status has to come from the backend rather than
  // from a fixture that would answer in its place.
  //
  // The picker file is given to EVERY desktop window, not just the one that will upload: it is a
  // process env var read at launch, there is no per-window channel for it, and a window that never
  // opens the picker is unaffected by it.
  const desktopContext: TestContext | undefined =
    isPro || fakeAvatarPickerFile
      ? { ...(isPro ? { pro: {} } : {}), ...(fakeAvatarPickerFile ? { fakeAvatarPickerFile } : {}) }
      : undefined;

  // Open each platform once, then slice per user (preserves Appium capability-index order).
  // The three platforms open CONCURRENTLY — a mixed test would otherwise pay the sum of three slow
  // openers. Windows within the desktop group still open sequentially: `openApps` does that
  // deliberately, because launching Electron windows in parallel triggers a sqlite error.
  //
  // `allSettled`, not `all`: on a rejection `all` returns immediately while its siblings keep
  // opening, and this function then throws without ever handing the caller the clients that DID
  // open — so those simulator/emulator sessions stay alive and pin their device for the next test.
  // Collect every outcome, close what opened, then rethrow the original failure.
  const [androidSettled, iosSettled, desktopSettled] = await Promise.allSettled([
    totalAndroid > 0 ? openAppMultipleDevices('android', totalAndroid, testInfo) : [],
    totalIos > 0
      ? openAppMultipleDevices('ios', totalIos, testInfo, isPro ? PRO_BACKEND_CONTEXT : undefined)
      : [],
    totalDesktop > 0
      ? openApps(totalDesktop, desktopContext).then(apps =>
          Promise.all(apps.map(app => waitFirstWindow(app)))
        )
      : [],
  ]);
  const androidPool = androidSettled.status === 'fulfilled' ? androidSettled.value : [];
  const iosPool = iosSettled.status === 'fulfilled' ? iosSettled.value : [];
  const desktopWindows = desktopSettled.status === 'fulfilled' ? desktopSettled.value : [];

  // Report EVERY opener that failed, not just the first. The three run concurrently, so a bad
  // simulator pool or a stale Desktop build routinely takes down more than one at a time — and
  // `.find()` would silently drop all but android's reason, which is the case allSettled exists to
  // handle well. Each reason is logged with its platform (that keeps its own stack intact), then a
  // single failure is rethrown verbatim and multiple are aggregated.
  const failures = (
    [
      ['android', androidSettled],
      ['ios', iosSettled],
      ['desktop', desktopSettled],
    ] as const satisfies ReadonlyArray<readonly [ClientPlatform, PromiseSettledResult<unknown>]>
  ).filter(
    (entry): entry is readonly [ClientPlatform, PromiseRejectedResult] =>
      entry[1].status === 'rejected'
  );
  if (failures.length > 0) {
    await closePartiallyOpenedClients([...androidPool, ...iosPool], desktopWindows);
    failures.forEach(([platform, r]) =>
      console.error(`Cross-platform open failed for ${platform}:`, r.reason)
    );
    if (failures.length === 1) {
      throw failures[0][1].reason;
    }
    throw new AggregateError(
      failures.map(([, r]) => r.reason as unknown),
      `${failures.length} platform openers failed: ` +
        failures
          .map(
            ([platform, r]) =>
              `${platform}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
          )
          .join(' | ')
    );
  }

  // Hand each window the identity it was launched with, or it cannot be brought back up: `restartApp`
  // needs the MULTI and NODE_APP_INSTANCE to relaunch against the same user-data directory, and a
  // restart is the only way a client observes a Pro grant made while it was running. Positional —
  // `openApps` launches windows in order and records each as it goes.
  const launchedInstances = getLaunchedInstances();
  const desktopPool = desktopWindows.map((page, i) => {
    const wrapper = new DesktopWrapper(page);
    if (multisAvailable[i] && launchedInstances[i]) {
      wrapper.setLaunchIdentity(multisAvailable[i], launchedInstances[i]);
    }
    return wrapper;
  });

  let ai = 0;
  let ii = 0;
  let di = 0;
  const users: UserClients[] = seedUsers.map((stateUser, idx) => {
    const spec = perUser[idx];
    const account = stateUser;
    const nameLc = stateUser.userName.toLowerCase();

    const android = androidPool.slice(ai, ai + (spec.android ?? 0));
    ai += spec.android ?? 0;
    const ios = iosPool.slice(ii, ii + (spec.ios ?? 0));
    ii += spec.ios ?? 0;
    const desktop = desktopPool.slice(di, di + (spec.desktop ?? 0));
    di += spec.desktop ?? 0;

    android.forEach((d, i) => d.setDeviceIdentity(`${nameLc}-android${i + 1}`));
    ios.forEach((d, i) => d.setDeviceIdentity(`${nameLc}-ios${i + 1}`));
    desktop.forEach((d, i) => {
      d.setDeviceIdentity(`${nameLc}-desktop${i + 1}`);
      // Restoring from a seed does not tell the wrapper WHICH account it landed on, and the desktop
      // verbs read it off the wrapper: `subscribeToPro` mints against `getUser()`, which without this
      // throws rather than minting.
      d.setAccount(stateUser);
    });

    return { account, android, ios, desktop, all: [...android, ...ios, ...desktop] };
  });

  // Restore every client from its account's recovery phrase, in parallel.
  await Promise.all(
    users.flatMap(u => u.all.map(client => client.restoreFromSeed(u.account.seedPhrase)))
  );

  return {
    prebuilt,
    users,
    desktopWindows,
    allClients: users.flatMap(u => u.all),
  };
}
