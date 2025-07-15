import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { AppearanceMenuItem, SelectAppIcon, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { AppDisguisePageScreenshot } from './utils/screenshot_paths';
import { verifyElementScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'App disguise icons',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: appDisguiseIcons,
  allureSuites: {
    parent: 'Settings',
    suite: 'App Disguise',
  },
  allureDescription: 'Verifies the alternate icons on the App Disguise page look as expected',
});

async function appDisguiseIcons(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, false);
  await device.clickOnElementAll(new UserSettings(device));
  // Must scroll down to reveal the Appearance menu item
  await device.scrollDown();
  await device.clickOnElementAll(new AppearanceMenuItem(device));
  await sleepFor(2000);
  // Must scroll down to reveal the app disguise option
  await device.scrollDown();
  await device.clickOnElementAll(new SelectAppIcon(device));
  await verifyElementScreenshot(device, new AppDisguisePageScreenshot(device), testInfo);
  await closeApp(device);
}
