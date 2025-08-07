import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  ReviewPromptNeedsWorkButton,
  ReviewPromptNotNowButton,
  ReviewPromptOpenSurveyButton,
} from './locators/home';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable } from './utils/utilities';

androidIt({
  title: 'Review prompt negative flow',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Flows',
  },
  allureDescription: 'Verifies the modal texts and buttons in the negative flow',
  testCb: reviewPromptPositive,
});

async function reviewPromptPositive(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  const version = await device.getVersionNumber();
  const url = `https://getsession.org/feedback?platform=${platform}&version=${version}`;

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
  await device.clickOnElementAll(new ReviewPromptNeedsWorkButton(device));
  await sleepFor(100);
  await device.checkModalStrings(
    englishStrippedStr('giveFeedback').toString(),
    englishStrippedStr('giveFeedbackDescription').toString()
  );
  await device.waitForTextElementToBePresent(new ReviewPromptNotNowButton(device));
  await device.clickOnElementAll(new ReviewPromptOpenSurveyButton(device));
  await device.checkModalStrings(
    englishStrippedStr('urlOpen').toString(),
    englishStrippedStr('urlOpenDescription').withArgs({ url }).toString()
  );
  await assertUrlIsReachable(url);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
