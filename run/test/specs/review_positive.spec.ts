import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ReviewPromptItsGreatButton,
  ReviewPromptNotNowButton,
  ReviewPromptRateAppButton,
} from './locators/home';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

androidIt({
  title: 'Review prompt positive flow',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Flows',
  },
  allureDescription: 'Verifies the modal texts and buttons in the positive flow',
  testCb: reviewPromptPositive,
});

async function reviewPromptPositive(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const storevariant = platform === 'android' ? 'Google Play Store' : 'App Store';
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.OPEN.USER_SETTINGS, async () => {
    await device.clickOnElementAll(new UserSettings(device));
  });
  await test.step('Open Path screen', async () => {
    await device.clickOnElementAll({
      strategy: 'xpath',
      selector: `//android.widget.TextView[@text="Path"]`,
    });
    await device.back();
    await device.back();
  });
  await device.checkModalStrings(
    englishStrippedStr('enjoyingSession').toString(),
    englishStrippedStr('enjoyingSessionDescription').toString()
  );
  await device.clickOnElementAll(new ReviewPromptItsGreatButton(device));
  await sleepFor(100);
  await device.checkModalStrings(
    englishStrippedStr('rateSession').toString(),
    englishStrippedStr('rateSessionModalDescription').withArgs({ storevariant }).toString()
  );
  await device.waitForTextElementToBePresent(new ReviewPromptRateAppButton(device));
  await device.waitForTextElementToBePresent(new ReviewPromptNotNowButton(device));
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
