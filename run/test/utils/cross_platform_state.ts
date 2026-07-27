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
import type { User } from '../../types/testing';

import { DesktopWrapper } from '../../desktop/DesktopWrapper';
import { openApps, waitFirstWindow } from '../../desktop/open';
import { IOS_PRO_CONTEXT } from './capabilities_ios';
import { getNetworkTarget } from './devnet';
import { openAppMultipleDevices } from './open_app';

/** How many clients of each platform a single account should have. */
export type PerUserPlatforms = {
  android?: number;
  ios?: number;
  desktop?: number;
};

/** One account together with the clients (across platforms) linked to it. */
export type UserClients = {
  account: User;
  android: DeviceWrapper[];
  ios: DeviceWrapper[];
  desktop: DesktopWrapper[];
  /** Every client of this account, ordered android → ios → desktop. */
  all: IBaseDeviceWrapper[];
};

function toUser(stateUser: StateUser): User {
  return {
    userName: stateUser.userName,
    accountID: stateUser.sessionId,
    recoveryPhrase: stateUser.seedPhrase,
  };
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
}: {
  stateToBuildKey: K;
  groupName: K extends WithGroupStateKey ? string : undefined;
  perUser: PerUserPlatforms[];
  testInfo: TestInfo;
  isPro?: boolean;
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

  // The seeder needs a network target; derive it from whichever mobile platform is present
  // (getNetworkTarget caches into DETECTED_NETWORK_TARGET, so this is consistent per run).
  const primaryPlatform = totalAndroid > 0 ? 'android' : 'ios';
  const net = await getNetworkTarget(primaryPlatform);
  const prebuilt = await buildStateForTest(stateToBuildKey, groupName, net);
  const seedUsers = (prebuilt as { users: StateUser[] }).users;

  if (perUser.length !== seedUsers.length) {
    throw new Error(
      `openAppsWithStateCrossPlatform: perUser has ${perUser.length} entries but state '${stateToBuildKey}' has ${seedUsers.length} users`
    );
  }

  // Open each platform once, then slice per user (preserves Appium capability-index order).
  const androidPool =
    totalAndroid > 0 ? await openAppMultipleDevices('android', totalAndroid, testInfo) : [];
  const iosPool =
    totalIos > 0
      ? await openAppMultipleDevices('ios', totalIos, testInfo, isPro ? IOS_PRO_CONTEXT : undefined)
      : [];
  const desktopApps = totalDesktop > 0 ? await openApps(totalDesktop) : [];
  const desktopWindows = await Promise.all(desktopApps.map(app => waitFirstWindow(app)));
  const desktopPool = desktopWindows.map(page => new DesktopWrapper(page));

  let ai = 0;
  let ii = 0;
  let di = 0;
  const users: UserClients[] = seedUsers.map((stateUser, idx) => {
    const spec = perUser[idx];
    const account = toUser(stateUser);
    const nameLc = stateUser.userName.toLowerCase();

    const android = androidPool.slice(ai, ai + (spec.android ?? 0));
    ai += spec.android ?? 0;
    const ios = iosPool.slice(ii, ii + (spec.ios ?? 0));
    ii += spec.ios ?? 0;
    const desktop = desktopPool.slice(di, di + (spec.desktop ?? 0));
    di += spec.desktop ?? 0;

    android.forEach((d, i) => d.setDeviceIdentity(`${nameLc}-android${i + 1}`));
    ios.forEach((d, i) => d.setDeviceIdentity(`${nameLc}-ios${i + 1}`));
    desktop.forEach((d, i) => d.setDeviceIdentity(`${nameLc}-desktop${i + 1}`));

    return { account, android, ios, desktop, all: [...android, ...ios, ...desktop] };
  });

  // Restore every client from its account's recovery phrase, in parallel.
  await Promise.all(
    users.flatMap(u => u.all.map(client => client.restoreFromSeed(u.account.recoveryPhrase)))
  );

  return {
    prebuilt,
    users,
    desktopWindows,
    allClients: users.flatMap(u => u.all),
  };
}
