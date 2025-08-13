import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { UserAvatar } from './locators/settings';
import { open_Alice2 } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Change profile picture linked device',
  risk: 'medium',
  testCb: avatarRestored,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
  allureDescription:
    'Verifies that the profile picture change on one device is reflected on a linked device.',
});

async function avatarRestored(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const expectedPixelHexColor = '04cbfe'; // This is the color of the profile picture image stored in the repo
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });
  await alice1.uploadProfilePicture();
  await test.step(TestSteps.VERIFY.PROFILE_PICTURE_CHANGED, async () => {
    await alice2.waitForElementColorMatch(new UserAvatar(alice2), expectedPixelHexColor, {
      maxWait: 20_000,
      elementTimeout: 500,
    });
  });
  await closeApp(alice1, alice2);
}
