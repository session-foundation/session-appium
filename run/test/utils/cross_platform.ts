import { type Page, test, type TestInfo } from '@playwright/test';

import type { AllureSuiteConfig } from '../../types/allure';
import type { DeviceWrapper } from '../../types/DeviceWrapper';
import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';

import { forceCloseAllWindows } from '../../desktop/closeWindows';
import { DesktopWrapper } from '../../desktop/DesktopWrapper';
import { openApps, resetTrackedElectronPids, waitFirstWindow } from '../../desktop/open';
import { type TestRisk, type User, USERNAME } from '../../types/testing';
import { IOS_PRO_CONTEXT } from './capabilities_ios';
import { newUser } from './create_account';
import { openAppsWithStateCrossPlatform } from './cross_platform_state';
import { unregisterDevicesForTest } from './device_registry';
import { getNetworkTarget } from './devnet';
import { captureLogsOnFailure, captureScreenshotsOnFailure } from './failure_artifacts';
import { closeApp, openAppMultipleDevices } from './open_app';

/** How many clients of each platform to open, all linked to ONE account ("alice"). */
export type CrossPlatformSetup = {
  android?: number;
  ios?: number;
  desktop?: number;
};

/** The clients of a single account (used for the optional second account, "bob"). */
export type AccountClients = {
  account: User;
  android: DeviceWrapper[];
  ios: DeviceWrapper[];
  desktop: DesktopWrapper[];
};

export type CrossPlatformClients = {
  /** The (first) account all top-level clients are linked to ("alice"). */
  account: User;
  /** Every client of "alice", ordered android → ios → desktop. */
  clients: IBaseDeviceWrapper[];
  android: DeviceWrapper[];
  ios: DeviceWrapper[];
  desktop: DesktopWrapper[];
  /**
   * A second, distinct account and its clients, present only when `bob` is requested.
   * When set, "alice" and "bob" are seeded as mutual friends via the qa-seeder.
   */
  bob?: AccountClients;
};

type CrossPlatformTestArgs = {
  title: string;
  risk: TestRisk;
  setup: CrossPlatformSetup;
  /**
   * Optional second account ("bob") with its own clients. When set, both accounts are
   * created as mutual friends via the qa-seeder (instead of minting a single account),
   * so a peer-visibility conversation exists on every client from the start.
   */
  bob?: CrossPlatformSetup;
  testCb: (clients: CrossPlatformClients, testInfo: TestInfo) => Promise<void>;
  shouldSkip?: boolean;
  isPro?: boolean;
  allureSuites?: AllureSuiteConfig;
  allureDescription?: string;
};

/**
 * Test template spanning MULTIPLE platforms in one run: opens the requested
 * Android/iOS (Appium) and Desktop (Electron) clients, mints one account on the
 * first mobile client, links every other client to it, and hands the built
 * clients to the callback.
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
export function crossPlatformTest({
  title,
  risk,
  setup,
  bob,
  testCb,
  shouldSkip = false,
  isPro = false,
}: CrossPlatformTestArgs) {
  const androidCount = setup.android ?? 0;
  const iosCount = setup.ios ?? 0;
  const desktopCount = setup.desktop ?? 0;

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
    if (androidCount > 0) {
      await getNetworkTarget('android');
    }
    if (iosCount > 0) {
      await getNetworkTarget('ios');
    }
    console.info(`\n\n==========> Running "${testName}"\n\n`);

    // Note: no allure test suite as an allure suite is per platforms
    // await setupAllureTestInfo({
    //   suites: allureSuites,
    //   description: allureDescription,
    //   platform: androidCount > 0 ? 'android' : 'ios',
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
      let clientsArg: CrossPlatformClients;

      if (bob) {
        // Two-account path: seed alice + bob as mutual friends via the qa-seeder and open
        // every client (across platforms) restored from the right seed.
        const state = await openAppsWithStateCrossPlatform({
          stateToBuildKey: '2friends',
          groupName: undefined,
          perUser: [
            { android: androidCount, ios: iosCount, desktop: desktopCount },
            { android: bob.android ?? 0, ios: bob.ios ?? 0, desktop: bob.desktop ?? 0 },
          ],
          testInfo,
          isPro,
        });
        const [aliceClients, bobClients] = state.users;

        // Feed the shared teardown arrays so the finally block cleans up every client.
        androidDevices.push(...aliceClients.android, ...bobClients.android);
        iosDevices.push(...aliceClients.ios, ...bobClients.ios);
        desktopClients.push(...aliceClients.desktop, ...bobClients.desktop);
        desktopWindows.push(...state.desktopWindows);

        clientsArg = {
          account: aliceClients.account,
          clients: aliceClients.all,
          android: aliceClients.android,
          ios: aliceClients.ios,
          desktop: aliceClients.desktop,
          bob: {
            account: bobClients.account,
            android: bobClients.android,
            ios: bobClients.ios,
            desktop: bobClients.desktop,
          },
        };
      } else {
        if (androidCount > 0) {
          androidDevices.push(...(await openAppMultipleDevices('android', androidCount, testInfo)));
        }
        if (iosCount > 0) {
          iosDevices.push(
            ...(await openAppMultipleDevices(
              'ios',
              iosCount,
              testInfo,
              isPro ? IOS_PRO_CONTEXT : undefined
            ))
          );
        }
        if (desktopCount > 0) {
          const apps = await openApps(desktopCount);
          for (let i = 0; i < apps.length; i++) {
            const page = await waitFirstWindow(apps[i]);
            desktopWindows.push(page);
            desktopClients.push(new DesktopWrapper(page, `alice-desktop${i + 1}`));
          }
        }

        const allMobile = [...androidDevices, ...iosDevices];
        if (allMobile.length === 0) {
          throw new Error(
            'crossPlatformTest needs at least one mobile client to create the account (desktop can only restore an existing account).'
          );
        }

        // Mint the account on the first mobile client, then link everyone else to it.
        const account = await newUser(allMobile[0], USERNAME.ALICE);
        const toLink: IBaseDeviceWrapper[] = [...allMobile.slice(1), ...desktopClients];
        await Promise.all(toLink.map(client => client.restoreFromSeed(account.recoveryPhrase)));

        clientsArg = {
          account,
          clients: [...androidDevices, ...iosDevices, ...desktopClients],
          android: androidDevices,
          ios: iosDevices,
          desktop: desktopClients,
        };
      }

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
