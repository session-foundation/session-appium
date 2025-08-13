import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UserAvatar } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Change profile picture',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: changeProfilePicture,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
  allureDescription:
    'Verifies that the profile picture can be changed and the new picture is displayed correctly.',
});

async function changeProfilePicture(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const expectedPixelHexColor = '04cbfe'; // This is the color of the profile picture image stored in the repo
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture();
  });
  await test.step(TestSteps.VERIFY.PROFILE_PICTURE_CHANGED, async () => {
    await device.waitForElementColorMatch(new UserAvatar(device), expectedPixelHexColor, {
      maxWait: 10_000,
      elementTimeout: 500,
    });
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
