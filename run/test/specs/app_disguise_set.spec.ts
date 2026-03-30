import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DisguisedApp } from '../locators/external';
import {
  AppDisguiseMeetingIcon,
  AppearanceMenuItem,
  CloseAppButton,
  SelectAppIcon,
  UserSettings,
} from '../locators/settings';
import { sleepFor } from '../utils';
import { newUser } from '../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
  uninstallApp,
} from '../utils/open_app';

bothPlatformsItSeparate({
  title: 'App disguise set icon',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  android: {
    testCb: appDisguiseSetIconAndroid,
  },
  ios: {
    testCb: appDisguiseSetIconIOS,
  },
  allureSuites: {
    parent: 'Settings',
    suite: 'App Disguise',
  },
  allureDescription: 'Verifies the alternate icon set on the App Disguise page is applied',
});

async function appDisguiseSetIconIOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.OPEN.APPEARANCE, async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new AppearanceMenuItem(device));
  });
  await test.step(TestSteps.USER_ACTIONS.APP_DISGUISE, async () => {
    await device.clickOnElementAll(new SelectAppIcon(device));
    try {
      await device.clickOnElementAll(new AppDisguiseMeetingIcon(device));
      // Commented this out until SES-5151 is resolved
      // await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('app disguise'), async () => {
      //   await device.waitForTextElementToBePresent({
      //     strategy: 'accessibility id',
      //     selector: 'You have changed the icon for “Session”.',
      //   });
      //   await device.clickOnElementAll({
      //     strategy: 'accessibility id',
      //     selector: 'OK',
      //   });
      // });
      // TODO maybe grab a screenshot of the disguised app and see what you can do with it
    } finally {
      // The disguised app must be uninstalled otherwise every following test will fail
      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
        await uninstallApp(device, platform);
      });
    }
  });
}

async function appDisguiseSetIconAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.OPEN.APPEARANCE, async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new AppearanceMenuItem(device));
  });
  await test.step(TestSteps.USER_ACTIONS.APP_DISGUISE, async () => {
    await device.clickOnElementAll(new SelectAppIcon(device));
    try {
      await device.clickOnElementAll(new AppDisguiseMeetingIcon(device));
      await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('app disguise'), async () => {
        await device.checkModalStrings(
          tStripped('appIconAndNameChange'),
          tStripped('appIconAndNameChangeConfirmation')
        );
      });
      await test.step('Verify app icon changed', async () => {
        await device.clickOnElementAll(new CloseAppButton(device));
        await sleepFor(2000);
        // Open app library and check for disguised app
        await device.swipeFromBottom();
        await device.waitForTextElementToBePresent(new DisguisedApp(device));
      });
    } finally {
      // The disguised app must be uninstalled otherwise every following test will fail
      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
        await uninstallApp(device, platform);
      });
    }
  });
}
