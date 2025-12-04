import test, { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { CloseSettings } from './locators';
import { CTAButtonPositive } from './locators/global';
import { ReviewPromptItsGreatButton } from './locators/home';
import { PathMenuItem, UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { forceStopAndRestart as forceStopAndRestartApp } from './utils/utilities';
import { verifyPageScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'Donate CTA shows after positive review',
  risk: 'high',
  testCb: donateCTAReview,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Donations',
  },
  allureDescription:
    'Verifies that the Donate CTA is shown after dismissing the positive review prompt; verifies modal strings and screenshot; and that the Donate button shows the correct Open URL modal.',
});

async function donateCTAReview(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const donateURL = 'https://getsession.org/donate#app';
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
  await test.step('Dismiss review prompt and restart the app', async () => {
    await device.clickOnElementAll(new ReviewPromptItsGreatButton(device));
    await device.clickOnElementAll(new CloseSettings(device));
    await forceStopAndRestartApp(device);
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Donate CTA'), async () => {
    await device.checkCTAStrings(
      englishStrippedStr('donateSessionHelp').toString(),
      englishStrippedStr('donateSessionDescription').toString(),
      [englishStrippedStr('donate').toString(), englishStrippedStr('maybeLater').toString()]
    );
  });
  // There *is* supposed to be a blur on Android but there is a bug on API 34 emulators preventing it from showing
  await test.step(TestSteps.VERIFY.SCREENSHOT('Donate CTA'), async () => {
    await verifyPageScreenshot(device, platform, 'cta_donate', testInfo);
  });
  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Open URL'), async () => {
    await device.clickOnElementAll(new CTAButtonPositive(device));
    await device.checkModalStrings(
      englishStrippedStr('urlOpen').toString(),
      englishStrippedStr('urlOpenDescription').withArgs({ url: donateURL }).toString()
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
