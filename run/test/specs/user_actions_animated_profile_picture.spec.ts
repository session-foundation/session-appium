import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { CloseSettings } from '../locators';
import { ConversationSettings, MessageBody } from '../locators/conversation';
import { ConversationItem } from '../locators/home';
import { PathMenuItem, UserAvatar, UserSettings } from '../locators/settings';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { IOSTestContext } from '../utils/capabilities_ios';
import { newUser } from '../utils/create_account';
import { makeAccountPro } from '../utils/mock_pro';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { forceStopAndRestart } from '../utils/utilities';
import { verifyPageScreenshot } from '../utils/verify_screenshots';

bothPlatformsIt({
  title: 'Upload animated profile picture (non Pro)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: nonProAnimatedDP,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
});

bothPlatformsIt({
  title: 'Upload animated profile picture (Pro)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proAnimatedDP,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Change Profile Picture',
  },
});

bothPlatformsIt({
  title: 'Pro Activated CTA',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: proActivatedCTA,
  allureSuites: {
    parent: 'Session Pro',
  },
});

bothPlatformsIt({
  title: 'Animated Profile Picture shows',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proAnimatedDPShows,
  allureSuites: {
    parent: 'Session Pro',
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
async function proActivatedCTA(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    sessionProEnabled: 'true',
  };
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  await makeAccountPro({ user: alice, platform });
  await forceStopAndRestart(device);
  await test.step('Verify Pro Activated CTA', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new UserAvatar(device));
    await device.clickOnElementAll({
      strategy: 'id',
      selector: 'pro-badge-text',
      text: tStripped('proAnimatedDisplayPictureModalDescription'),
    });
    await verifyPageScreenshot(device, platform, 'cta_pro_activated', testInfo);
    await device.checkCTA('alreadyActivated');
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
  await makeAccountPro({ user: alice, platform });
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

async function proAnimatedDPShows(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const iosContext: IOSTestContext = {
    sessionProEnabled: 'true',
  };
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
      iOSContext: iosContext,
    });
  });
  const { alice1, bob1 } = devices;
  const { alice, bob } = prebuilt;
  await makeAccountPro({ user: alice, platform });
  await forceStopAndRestart(alice1);
  await test.step(TestSteps.USER_ACTIONS.CHANGE_PROFILE_PICTURE, async () => {
    await alice1.uploadProfilePicture(true);
  });
  await alice1.clickOnElementAll(new CloseSettings(alice1));
  await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
  await alice1.sendMessage('Howdy');
  await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, 'Howdy'));
  await bob1.verifyElementIsAnimated(new ConversationSettings(bob1));
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
