import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { UserAvatar, UserSettings } from '../locators/settings';
import { open_Alice2 } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

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
  const tolerance = 5; // Slightly higher than default tolerance because of jpeg compression
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });
  await alice2.clickOnElementAll(new UserSettings(alice2));
  await alice1.uploadProfilePicture();
  await test.step(TestSteps.VERIFY.PROFILE_PICTURE_CHANGED, async () => {
    await alice2.waitForElementColorMatch(
      { ...new UserAvatar(alice2).build(), maxWait: 20_000 },
      expectedPixelHexColor,
      tolerance
    );
  });
  await closeApp(alice1, alice2);
}
