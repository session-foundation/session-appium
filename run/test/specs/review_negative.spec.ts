import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ReviewPromptNeedsWorkButton,
  ReviewPromptNotNowButton,
  ReviewPromptOpenSurveyButton,
} from './locators/home';
import { PathMenuItem } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable } from './utils/utilities';

bothPlatformsIt({
  title: 'Review prompt negative flow',
  risk: 'high',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Flows',
  },
  allureDescription:
    'Verifies the in-app review modal texts and buttons for the negative flow (Enjoying Session - Give Feedback - Open URL)',
  testCb: reviewPromptNegative,
});

async function reviewPromptNegative(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  const version = await device.getVersionNumber();
  const platformParam = platform === 'ios' ? 'iOS' : 'android'; // we call it ios but the app prints iOS
  const url = `https://getsession.org/feedback?platform=${platformParam}&version=${version}`;

  await test.step(TestSteps.OPEN.PATH, async () => {
    await device.clickOnElementAll(new PathMenuItem(device));
    await device.back();
    await device.back();
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Enjoying Session'), async () => {
    await device.checkModalStrings(
      tStripped('enjoyingSession'),
      tStripped('enjoyingSessionDescription')
    );
    await device.clickOnElementAll(new ReviewPromptNeedsWorkButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Give Feedback'), async () => {
    await device.checkModalStrings(tStripped('giveFeedback'), tStripped('giveFeedbackDescription'));
    await device.waitForTextElementToBePresent(new ReviewPromptNotNowButton(device));
    await device.clickOnElementAll(new ReviewPromptOpenSurveyButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Open URL'), async () => {
    await device.checkModalStrings(tStripped('urlOpen'), tStripped('urlOpenDescription', { url }));
    await assertUrlIsReachable(url);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
