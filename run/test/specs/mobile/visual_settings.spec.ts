import type { StateUser } from '@session-foundation/qa-seeder';

import { test, type TestInfo } from '@playwright/test';
import { mnDecode } from '@session-foundation/mnemonic';

import { TestSteps } from '../../../types/allure';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { BlockedContactsSettings } from '../../locators';
import { AccountIDDisplay } from '../../locators/global';
import {
  AppearanceMenuItem,
  ClassicLightThemeOption,
  ClearDataConfirmButton,
  ClearDataMenuItem,
  ClearDeviceAndNetworkRadio,
  ConversationsMenuItem,
  FastModeOption,
  LockAppToggle,
  NotificationsMenuItem,
  PrivacyMenuItem,
  UserSettings,
} from '../../locators/settings';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { restoreAccount } from '../../utils/restore_account';
import { verifyPageScreenshot } from '../../utils/verify_screenshots';

/**
 * The account every baseline on these screens is captured with. It has to be fixed: the Settings screen
 * renders the Account ID and an avatar coloured from the pubkey, and a generated account moves both on
 * every run — 83,623 pixels, 2.64% of the frame, and nothing outside those two elements. A threshold
 * loose enough to absorb that cannot describe rendering, which is what these specs are for.
 *
 * A throwaway devnet identity with nothing attached to it, checked in deliberately: the suite's other
 * fixed account (`SOGS_ADMIN_SEED`) is an env var because it holds real admin rights on a SOGS server,
 * and this one holds nothing. `restoreAccount` rather than `restoreAccountNoFallback` because a rebuilt
 * devnet has no config for it, and the fallback fills the display name in rather than failing.
 */
const BASELINE_SEED_PHRASE =
  'bevel zebra roomy focus cowl avatar february moat website oven amaze hoisting bevel';

const BASELINE_ACCOUNT: StateUser = {
  // Decoded rather than written out, so the bytes cannot drift from the phrase above.
  seed: Buffer.from(mnDecode(BASELINE_SEED_PHRASE), 'hex'),
  seedPhrase: BASELINE_SEED_PHRASE,
  // What the app itself renders on the Settings screen for this seed, so the baseline and this
  // constant describe the same account.
  sessionId: '05abbe8736e2af3b64a47407cf4d63da990e45e4be5ac9e95b88e8fc93a09ed04d',
  userName: USERNAME.ALICE,
};

// Every case waits for something the DESTINATION has and Settings does not. The click returns before the
// push completes, so without it a loaded host screenshots the screen behind — which reads as a wholesale
// layout change (measured at SSIM 0.38, 37% of the frame) rather than as a capture taken too early.
/**
 * Wipe the baseline account from the device and the swarm once the screenshot is taken.
 *
 * The account is restored from a fixed seed on every run, so anything it accumulates persists across runs
 * and eventually shows up in the very images this spec compares. Clearing device AND network leaves the
 * seed reusable while removing the state behind it.
 *
 * Deliberately best-effort. This runs AFTER the assertion the spec exists for, so a teardown that glitches
 * must not turn a passing visual check red — the failure it would report is not about the layout. It logs
 * loudly instead, which is what makes a persistent cleanup problem visible without coupling it to the
 * result.
 */
async function clearBaselineAccount(device: DeviceWrapper, atSettingsRoot: boolean): Promise<void> {
  try {
    if (!atSettingsRoot) {
      // Every case above is at most one level below Settings.
      await device.navigateBack();
    }
    // Scrolled on BOTH platforms, not just iOS: "Clear data" sits below the fold either way, and Android
    // recycles off-screen rows out of the hierarchy entirely, so there it is unqueryable rather than
    // merely out of view.
    await device.scrollDown();
    await device.clickOnElementAll(new ClearDataMenuItem(device));
    await device.clickOnElementAll(new ClearDeviceAndNetworkRadio(device));
    await device.clickOnElementAll(new ClearDataConfirmButton(device));
    device.log('Baseline account cleared from device and network');
  } catch (error) {
    device.log(
      `Could not clear the baseline account, leaving its state in place: ${(error as Error).message}`
    );
  }
}

const testCases = [
  {
    screenName: 'Settings page',
    screenshotFile: 'settings',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.waitForTextElementToBePresent(new AccountIDDisplay(device));
    },
  },
  {
    screenName: 'Privacy settings',
    screenshotFile: 'settings_privacy',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new PrivacyMenuItem(device));
      await device.waitForTextElementToBePresent(new LockAppToggle(device));
    },
  },
  {
    screenName: 'Conversations settings',
    screenshotFile: 'settings_conversations',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new ConversationsMenuItem(device));
      await device.waitForTextElementToBePresent(new BlockedContactsSettings(device));
    },
  },
  {
    screenName: 'Notifications settings',
    screenshotFile: 'settings_notifications',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.onIOS().scrollDown();
      await device.clickOnElementAll(new NotificationsMenuItem(device));
      await device.waitForTextElementToBePresent(new FastModeOption(device));
    },
  },
  {
    screenName: 'Appearance settings',
    screenshotFile: 'settings_appearance',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new AppearanceMenuItem(device));
      // A theme row rather than the app icon row further down the screen: iOS only publishes the table
      // cells it has rendered, so an element below the fold is present or absent depending on how far
      // the list happened to build — which fails the wait on a screen that is fully up.
      await device.waitForTextElementToBePresent(new ClassicLightThemeOption(device));
    },
  },
] as const;

for (const { screenName, screenshotFile, navigation } of testCases) {
  bothPlatformsIt({
    title: `Check ${screenName} layout`,
    risk: 'high',
    countOfDevicesNeeded: 1,
    allureSuites: {
      parent: 'Visual Checks',
      suite: 'Settings',
    },
    allureDescription: `Verifies that the ${screenName} screen layout matches the expected baseline`,
    testCb: async (platform: SupportedPlatformsType, testInfo: TestInfo) => {
      const { device } = await test.step('Restore the baseline account', async () => {
        const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
        await restoreAccount(device, BASELINE_ACCOUNT, 'alice1', {
          allowNotificationPermissions: false,
        });
        return { device };
      });

      await test.step(TestSteps.OPEN.GENERIC(screenName), async () => {
        await navigation(device);
      });

      await test.step(TestSteps.VERIFY.SCREENSHOT(screenName), async () => {
        await verifyPageScreenshot(device, platform, screenshotFile, testInfo, 0.96); // Lower-than-standard tolerance to account for variable elements out of our control (e.g. Account ID)
      });

      await test.step('Clear the baseline account', async () => {
        await clearBaselineAccount(device, screenshotFile === 'settings');
      });

      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
      });
    },
  });
}
