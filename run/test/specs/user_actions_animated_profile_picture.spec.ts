import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { PathMenuItem, UserAvatar } from '../locators/settings';
import { IOSTestContext } from '../utils/capabilities_ios';
import { newUser } from '../utils/create_account';
import { makeAccountPro } from '../utils/mock_pro';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { forceStopAndRestart } from '../utils/utilities';

bothPlatformsIt({
  title: 'Upload animated profile picture (non Pro)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: nonProAnimatedDP,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
});

bothPlatformsIt({
  title: 'Upload animated profile picture (Pro)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proAnimatedDP,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
});

async function nonProAnimatedDP(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    sessionProEnabled: 'true',
  };
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture(true);
    await device.checkCTA('animatedProfilePicture');
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
async function proAnimatedDP(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    sessionProEnabled: 'true',
  };
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  await makeAccountPro({
    mnemonic: alice.recoveryPhrase,
    provider: 'google',
  });
  await forceStopAndRestart(device);
  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await device.uploadProfilePicture(true);
  });
  await device.waitForTextElementToBePresent(new PathMenuItem(device));
  await device.verifyNoCTAShows();
  await device.verifyElementIsAnimated(new UserAvatar(device));
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
