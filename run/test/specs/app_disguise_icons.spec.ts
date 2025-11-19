import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { AppearanceMenuItem, SelectAppIcon, UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { verifyPageScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'Check app disguise icon layout',
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
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.OPEN.APPEARANCE, async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new AppearanceMenuItem(device));
  });
  await test.step(TestSteps.VERIFY.SCREENSHOT('app disguise icons'), async () => {
    await device.clickOnElementAll(new SelectAppIcon(device));
    await verifyPageScreenshot(device, platform, 'app_disguise', testInfo, 0.99); // Higher-than-standard tolerance for near perfect match
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
