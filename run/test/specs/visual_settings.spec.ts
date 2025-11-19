import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { NotificationsMenuItem } from './locators/settings';
import {
  AppearanceMenuItem,
  ConversationsMenuItem,
  PrivacyMenuItem,
  UserSettings,
} from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { verifyPageScreenshot } from './utils/verify_screenshots';

const testCases = [
  {
    screenName: 'Settings page',
    screenshotFile: 'settings',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
    },
  },
  {
    screenName: 'Privacy settings',
    screenshotFile: 'settings_privacy',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new PrivacyMenuItem(device));
    },
  },
  {
    screenName: 'Conversations settings',
    screenshotFile: 'settings_conversations',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new ConversationsMenuItem(device));
    },
  },
  {
    screenName: 'Notifications settings',
    screenshotFile: 'settings_notifications',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new NotificationsMenuItem(device));
      await sleepFor(1_000); // This one otherwise captures a black screen
    },
  },
  {
    screenName: 'Appearance settings',
    screenshotFile: 'settings_appearance',
    navigation: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new AppearanceMenuItem(device));
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
      const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
        const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
        await newUser(device, USERNAME.ALICE, {
          saveUserData: false,
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

      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
      });
    },
  });
}
