import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ModalHeading } from './locators/global';
import { PlusButton } from './locators/home';
import { UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

androidIt({
  title: 'Review prompt once',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Triggers',
  },
  allureDescription: 'Verifies that the in-app review prompt shows once after triggered',
  testCb: reviewPromptOnce,
});

async function reviewPromptOnce(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, false);
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
  await device.clickOnByAccessibilityID('back') // Yes this is lowercase to close the modal
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
  await device.waitForTextElementToBePresent(new PlusButton(device)); // Making sure we're on the home screen
  await device.verifyElementNotPresent(new ModalHeading(device));
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
