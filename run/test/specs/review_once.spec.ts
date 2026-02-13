import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { CloseSettings } from '../locators';
import { ModalHeading } from '../locators/global';
import { PlusButton } from '../locators/home';
import { PathMenuItem, UserSettings } from '../locators/settings';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Review prompt only once',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'In-App Review Prompt',
    suite: 'Triggers',
  },
  allureDescription: 'Verifies that the in-app review prompt only shows shows once after triggered',
  testCb: reviewPromptOnce,
});

async function reviewPromptOnce(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  await test.step(TestSteps.VERIFY.GENERIC_MODAL, async () => {
    await device.checkModalStrings(
      tStripped('enjoyingSession'),
      tStripped('enjoyingSessionDescription')
    );
    await device.clickOnElementAll(new CloseSettings(device));
  });
  await test.step(TestSteps.OPEN.PATH, async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new PathMenuItem(device));
    await device.back();
    await device.back();
  });
  await test.step('Verify review prompt is not shown again', async () => {
    await device.waitForTextElementToBePresent(new PlusButton(device)); // Making sure we're on the home screen
    await device.verifyElementNotPresent(new ModalHeading(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
