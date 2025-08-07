import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { AppearanceMenuItem, DonationsMenuItem, UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

// Yes, multiple tests in one file! 
const reviewTriggers = [
  {
    titleSnippet: 'Donate',
    descriptionSnippet: 'presses the Donate button in Settings',
    testStepName: 'Open Donations menu item',
    trigger: async (device: DeviceWrapper) => {
      await device.clickOnElementAll(new DonationsMenuItem(device));
    },
  },
  {
    titleSnippet: 'Path',
    descriptionSnippet: 'visits the Path screen in Settings',
    testStepName: 'Open Path screen',
    trigger: async (device: DeviceWrapper) => {
      await device.clickOnElementAll({
        strategy: 'xpath',
        selector: `//android.widget.TextView[@text="Path"]`,
      });
    },
  },
  {
    titleSnippet: 'Appearance',
    descriptionSnippet: 'sets a different theme',
    testStepName: 'Set a different theme',
    trigger: async (device: DeviceWrapper) => {
      await device.scrollDown();
      await device.clickOnElementAll(new AppearanceMenuItem(device));
      await device.clickOnElementById('network.loki.messenger.qa:id/theme_option_classic_light');
    },
  },
];

for (const { titleSnippet, descriptionSnippet, testStepName, trigger } of reviewTriggers) {
  androidIt({
    title: `Review prompt ${titleSnippet} trigger`,
    risk: 'high',
    countOfDevicesNeeded: 1,
    allureSuites: {
      parent: 'In-App Review Prompt',
      suite: 'Triggers',
    },
    allureDescription: `Verifies that the in-app review prompt shows after the user ${descriptionSnippet}`,
    testCb: async (platform: SupportedPlatformsType, testInfo: TestInfo) => {
      const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
        const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
        await newUser(device, USERNAME.ALICE, false);
        return { device };
      });
      await test.step(TestSteps.OPEN.USER_SETTINGS, async () => {
        await device.clickOnElementAll(new UserSettings(device));
      });
      await test.step(testStepName, async () => {
        await trigger(device);
        await device.back();
        await device.back();
      });
      await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('App Review'), async () => {
        await device.checkModalStrings(
          englishStrippedStr('enjoyingSession').toString(),
          englishStrippedStr('enjoyingSessionDescription').toString()
        );
        await device.waitForTextElementToBePresent({
          strategy: 'id',
          selector: `It's Great ❤️`,
        });
        await device.waitForTextElementToBePresent({
          strategy: 'id',
          selector: `Needs Work 😕`,
        });
      });
      await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
        await closeApp(device);
      });
    },
  });
}
