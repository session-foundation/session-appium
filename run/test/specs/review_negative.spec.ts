import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
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
  const url = `https://getsession.org/feedback?platform=${platform}&version=${version}`;

  await test.step(TestSteps.OPEN.PATH, async () => {
    await device.clickOnElementAll(new PathMenuItem(device));
    await device.back();
    await device.back();
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Enjoying Session'), async () => {
    await device.checkModalStrings(
      englishStrippedStr('enjoyingSession').toString(),
      englishStrippedStr('enjoyingSessionDescription').toString()
    );
    await device.clickOnElementAll(new ReviewPromptNeedsWorkButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Give Feedback'), async () => {
    await device.checkModalStrings(
      englishStrippedStr('giveFeedback').toString(),
      englishStrippedStr('giveFeedbackDescription').toString()
    );
    await device.waitForTextElementToBePresent(new ReviewPromptNotNowButton(device));
    await device.clickOnElementAll(new ReviewPromptOpenSurveyButton(device));
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Open URL'), async () => {
    await device.checkModalStrings(
      englishStrippedStr('urlOpen').toString(),
      englishStrippedStr('urlOpenDescription').withArgs({ url }).toString()
    );
    await assertUrlIsReachable(url);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
