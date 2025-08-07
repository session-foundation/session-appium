import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable } from './utils/utilities';

androidIt({
  title: 'Review negative flow',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Triggers',
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
  await device.clickOnElementById(`Needs Work 😕`);
  await device.checkModalStrings(
    englishStrippedStr('giveFeedback').toString(),
    englishStrippedStr('giveFeedbackDescription').toString()
  );
  await device.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'Open Survey',
  });
  await device.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'Not now',
  });
  await device.clickOnElementAll({
    strategy: 'id',
    selector: 'Open Survey',
  });
  await device.checkModalStrings(
    englishStrippedStr('urlOpen').toString(),
    englishStrippedStr('urlOpenDescription').withArgs({ url }).toString()
  );
  await assertUrlIsReachable(url);
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
