import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ReviewPromptItsGreatButton,
  ReviewPromptNotNowButton,
  ReviewPromptRateAppButton,
} from '../locators/home';
import { PathMenuItem, UserSettings } from '../locators/settings';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Review prompt positive flow',
  risk: 'high',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Flows',
  },
  allureDescription:
    'Verifies the in-app review modal texts and buttons for the positive flow (Enjoying Session - Rate App)',
  testCb: reviewPromptPositive,
});

async function reviewPromptPositive(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const storevariant = platform === 'android' ? 'Google Play Store' : 'App Store';
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.OPEN.PATH, async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new PathMenuItem(device));
    await device.back();
    await device.back();
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Enjoying Session'), async () => {
    await device.checkModalStrings(
      tStripped('enjoyingSession'),
      tStripped('enjoyingSessionDescription')
    );
    await device.clickOnElementAll(new ReviewPromptItsGreatButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Rate Session'), async () => {
    await device.checkModalStrings(tStripped('rateSession'), tStripped('rateSessionModalDescriptionUpdated', { storevariant }));
    await device.waitForTextElementToBePresent(new ReviewPromptRateAppButton(device));
    await device.verifyElementNotPresent(new ReviewPromptNotNowButton(device)); // This modal now only has the Rate button
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
