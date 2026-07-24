import type { PrebuiltStateKey, StateGroup, UserNameType } from '@session-foundation/qa-seeder';

import { type Page, test, type TestInfo } from '@playwright/test';

import type { AllureSuiteConfig } from '../../types/allure';
import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';

import { forceCloseAllWindows } from '../../desktop/closeWindows';
import { DesktopWrapper } from '../../desktop/DesktopWrapper';
import { resetTrackedElectronPids } from '../../desktop/open';
import { type TestRisk, type User } from '../../types/testing';
import { openAppsWithStateCrossPlatform } from './cross_platform_state';
import { focusConvoCrossPlatform } from './cross_platform_state_builder';
import { unregisterDevicesForTest } from './device_registry';
import { getNetworkTarget } from './devnet';
import { captureLogsOnFailure, captureScreenshotsOnFailure } from './failure_artifacts';
import { closeApp } from './open_app';

/** How many clients of each platform a single account should have. */
export type CrossPlatformSetup = {
  android?: number;
  ios?: number;
  desktop?: number;
};

/** One account together with the clients (across platforms) linked to it. */
export type AccountClients = {
  account: User;
  /** Every client of this account, ordered android → ios → desktop. */
  clients: IBaseDeviceWrapper[];
  android: DeviceWrapper[];
  ios: DeviceWrapper[];
  desktop: DesktopWrapper[];
};

/**
 * Account-handle key: the seeder's usernames (`UserNameType`) lowercased — `'Alice'` →
 * `'alice'`. These are the keys the setup factories use and that the test callback's
 * `accounts` map is keyed by. Concrete values live in `ACCOUNT` (cross_platform_state_builder).
 */
export type AccountName = Lowercase<UserNameType>;

/** One account's requested clients, tagged with the seed username it maps to. */
export type NamedAccountSpec = {
  name: AccountName;
  platforms: CrossPlatformSetup;
};

/**
 * A cross-platform state "setup": WHICH qa-seeder state to build and, per account, how
 * many clients of each platform to link to it. Produced by the factory helpers in
 * `cross_platform_state_builder.ts` (`friends`, `strangers`, `friendsInGroup`,
 * `linkedDevices`) so specs declare the setup TYPE declaratively instead of hand-picking a
 * state key. Every account is seeded (no UI onboarding) and every client is restored from
 * its account's seed.
 *
 * `Names` is the union of account names this setup exposes (e.g. `'alice' | 'bob'`), used
 * to type the callback's name-keyed `accounts` map.
 */
export type CrossPlatformStateSetup<Names extends AccountName = AccountName> = {
  stateKey: PrebuiltStateKey;
  groupName: string | undefined;
  /** Per account, index-aligned with the seeder's users (Alice, Bob, Charlie…). */
  accounts: NamedAccountSpec[];
  /** Account names in seed order — carries `Names` for callback typing. */
  names: readonly Names[];
  /** For group setups: open the group conversation on every client before the test. */
  focusGroup: boolean;
};

export type CrossPlatformClients<Names extends AccountName = AccountName> = {
  /** Built clients keyed by account name (as declared by the setup factory). */
  accounts: Record<Names, AccountClients>;
  /** The seeded group, present only for group setups. */
  group?: StateGroup;
};

type CrossPlatformTestArgs<Names extends AccountName> = {
  title: string;
  risk: TestRisk;
  /**
   * The state to build, produced by a factory in `cross_platform_state_builder.ts`
   * (e.g. `friends({ alice: { android: 1 }, bob: { desktop: 1 } })`). Drives seeding,
   * how many clients open per account/platform, and (for groups) whether to focus.
   */
  setup: CrossPlatformStateSetup<Names>;
  testCb: (clients: CrossPlatformClients<Names>, testInfo: TestInfo) => Promise<void>;
  shouldSkip?: boolean;
  isPro?: boolean;
  allureSuites?: AllureSuiteConfig;
  allureDescription?: string;
};

/**
 * Test template spanning MULTIPLE platforms in one run: opens the requested
 * Android/iOS (Appium) and Desktop (Electron) clients for one OR several accounts,
 * seeds every account (and their relationship/group) via the qa-seeder, links every
 * client to its account, and hands the built clients — keyed by account name — to the
 * callback.
 *
 * Account creation is ALWAYS seeder-based — for a single account too. No client is ever
 * onboarded through the UI; every client (mobile and desktop) is restored from its
 * account's recovery phrase.
 *
 * Lifecycle ownership (why this is a template and not per-wrapper cleanup):
 * - Desktop: `resetTrackedElectronPids()` on start and `forceCloseAllWindows()` on
 *   finally, so every Electron process the test spawned — including windows the
 *   app respawns/reopens mid-test — is force-killed. We don't track individual
 *   desktop pids.
 * - Mobile: sessions are closed with `closeApp` and unregistered from the device
 *   registry (which also drives failure-artifact capture).
 *
 * Tagged `@cross-platform` (NOT `@android`/`@ios`) so it stays out of the
 * single-platform CI shards. Run with `--grep '@cross-platform'`.
 */
export function crossPlatformTest<Names extends AccountName>({
  title,
  risk,
  setup,
  testCb,
  shouldSkip = false,
  isPro = false,
}: CrossPlatformTestArgs<Names>) {
  const totalAndroid = setup.accounts.reduce((sum, a) => sum + (a.platforms.android ?? 0), 0);
  const totalIos = setup.accounts.reduce((sum, a) => sum + (a.platforms.ios ?? 0), 0);

  const proTag = isPro ? ' @pro' : '';
  const testName = `${title} @cross-platform @${risk ?? 'default'}-risk${proTag}`;

  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
    return;
  }

  // eslint-disable-next-line no-empty-pattern
  test(testName, async ({}, testInfo) => {
    if (totalAndroid > 0) {
      await getNetworkTarget('android');
    }
    if (totalIos > 0) {
      await getNetworkTarget('ios');
    }
    console.info(`\n\n==========> Running "${testName}"\n\n`);

    // Note: no allure test suite as an allure suite is per platforms
    // await setupAllureTestInfo({
    //   suites: allureSuites,
    //   description: allureDescription,
    //   platform: totalAndroid > 0 ? 'android' : 'ios',
    // });

    // Enable Session Pro (dev backend) before launching desktop windows.
    if (isPro) {
      process.env.SESSION_PRO = '1';
      process.env.TEST_PRO_BACKEND = '1';
    }
    // Desktop lifecycle is owned here: reset pids before opening any window.
    resetTrackedElectronPids();

    const androidDevices: DeviceWrapper[] = [];
    const iosDevices: DeviceWrapper[] = [];
    const desktopClients: DesktopWrapper[] = [];
    const desktopWindows: Page[] = [];
    let testFailed = false;

    try {
      // Every account — single or multiple — is seeded via the qa-seeder and every client is
      // linked (restore-from-seed only; no UI account creation).
      const state = await openAppsWithStateCrossPlatform({
        stateToBuildKey: setup.stateKey,
        groupName: setup.groupName,
        perUser: setup.accounts.map(a => ({
          android: a.platforms.android ?? 0,
          ios: a.platforms.ios ?? 0,
          desktop: a.platforms.desktop ?? 0,
        })),
        testInfo,
        isPro,
      });

      // Feed the shared teardown arrays so the finally block cleans up every client.
      for (const user of state.users) {
        androidDevices.push(...user.android);
        iosDevices.push(...user.ios);
        desktopClients.push(...user.desktop);
      }
      desktopWindows.push(...state.desktopWindows);

      const group = 'group' in state.prebuilt ? state.prebuilt.group : undefined;

      // Key the built clients by the account names the setup declared (seed order).
      const accountsByName = {} as Record<Names, AccountClients>;
      state.users.forEach((user, i) => {
        const name = setup.names[i];
        accountsByName[name] = {
          account: user.account,
          clients: user.all,
          android: user.android,
          ios: user.ios,
          desktop: user.desktop,
        };
      });

      // Group setups: open the group conversation on every client before the test runs.
      if (setup.focusGroup && group) {
        await focusConvoCrossPlatform(state.allClients, group.groupName);
      }

      const clientsArg: CrossPlatformClients<Names> = { accounts: accountsByName, group };

      await testCb(clientsArg, testInfo);

      // If the test passed but used healing, fail loudly to surface it in the report.
      const healedAnnotations = testInfo.annotations.filter(a => a.type === 'healed');
      if (healedAnnotations.length > 0) {
        const uniqueHealings = [...new Set(healedAnnotations.map(a => a.description))];
        uniqueHealings.sort();
        throw new Error(`Test passed but used healed locators:\n${uniqueHealings.join('\n')}`);
      }
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      try {
        if (
          testFailed ||
          testInfo.errors.length > 0 ||
          testInfo.status === 'failed' ||
          testInfo.status === 'timedOut'
        ) {
          await captureScreenshotsOnFailure(testInfo);
          await captureLogsOnFailure(testInfo);
        }
      } catch (artifactError) {
        console.error('Failed to capture failure artifacts:', artifactError);
      }

      // Mobile: close Appium sessions.
      try {
        await closeApp(...androidDevices, ...iosDevices);
      } catch (closeError) {
        console.error('Failed to close mobile sessions:', closeError);
      }

      // Desktop: force-kill every Electron process spawned by this test.
      try {
        await forceCloseAllWindows(desktopWindows);
      } catch (desktopError) {
        console.error('forceCloseAllWindows failed:', desktopError);
      }

      try {
        unregisterDevicesForTest(testInfo);
      } catch (cleanupError) {
        console.error('Failed to unregister devices:', cleanupError);
      }
    }
  });
}
