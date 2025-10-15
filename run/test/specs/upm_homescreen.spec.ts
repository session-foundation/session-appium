import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { verifyPageScreenshot } from './utils/verify_screenshots';

androidIt({
  title: 'User Profile Modal Home Screen',
  risk: 'high',
  testCb: upmHomeScreen,
  countOfDevicesNeeded: 2,
});

async function upmHomeScreen(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
    });
  });
  await test.step('Open User Profile Modal on home screen', async () => {
    await alice1.longPressConversation(bob.userName);
    await alice1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Details',
    });
  });
  await test.step(TestSteps.VERIFY.SCREENSHOT('user profile modal'), async () => {
    await verifyPageScreenshot(alice1, platform, 'upm_home', testInfo);
  });
  await test.step(`Verify ${bob.userName} display name in user profile modal`, async () => {
    await alice1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'pro-badge-text',
      text: bob.userName,
    });
  });
  await test.step(`Verify ${bob.userName} account id in user profile modal`, async () => {
    const el = await alice1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'account-id',
    });
    const eltext = await alice1.getTextFromElement(el);
    const normalized = eltext.replace(/\s+/g, ''); // account id comes in two lines
    if (eltext !== bob.sessionId) {
      throw new Error(`Account ID does not match.
    Expected: ${bob.sessionId}
    Observed: ${normalized}`);
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
