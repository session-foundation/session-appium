import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ChangeProfilePictureButton, CloseSettings } from '../../locators';
import { ConversationSettings, MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import {
  PathMenuItem,
  ProAnimatedDisplayPictureModalDescription,
  UserAvatar,
  UserSettings,
} from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT, iosActiveProContext } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import { makeAccountPro } from '../../utils/mock_pro';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { runOnlyOnAndroid } from '../../utils/run_on';
import { forceStopAndRestart } from '../../utils/utilities';
import { verifyPageScreenshot } from '../../utils/verify_screenshots';

bothPlatformsIt({
  title: 'Upload animated profile picture (non Pro)',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: nonProAnimatedDP,
  isPro: true,
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
  isPro: true,
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
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
});

bothPlatformsIt({
  title: 'Animated Profile Picture shows',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proAnimatedDPShows,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
});

async function nonProAnimatedDP(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
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
/**
 * This asserts how the CTA *renders* for a Pro user — no cryptographic outcome — so iOS mocks the Pro
 * state rather than buying it. That removes the mint, the restart and, importantly, a race the real
 * grant cannot win: the client skips a status refresh if the last one was under a minute ago
 * (`ProStatusRepository.MIN_UPDATE_INTERVAL_SECONDS`), and the account's first fetch necessarily
 * happens during onboarding, before there is anything to buy.
 *
 * Android keeps the backend route only because it has no launch-arg mocks yet, and is subject to that
 * race. The assertions below are identical on both platforms — only the setup differs.
 */
async function proActivatedCTA(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(
      platform,
      testInfo,
      iosActiveProContext()
    );
    // The recovery phrase is only needed to derive the Pro master key for a real grant, and reading it
    // costs a trip through settings — so only pay for it on the platform that mints.
    const alice = await newUser(device, USERNAME.ALICE, {
      saveUserData: platform === 'android',
    });
    return { device, alice };
  });

  await runOnlyOnAndroid(platform, async () => {
    await makeAccountPro({ user: alice, platform });
    await forceStopAndRestart(device);
  });

  await device.dismissCTA();
  await test.step('Verify Pro Activated CTA', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new UserAvatar(device));
    await device.waitForTextElementToBePresent(new ChangeProfilePictureButton(device));
    await device.clickOnElementAll(new ProAnimatedDisplayPictureModalDescription(device));
    await device.checkCTA('alreadyActivated');
    await verifyPageScreenshot(device, platform, 'cta_pro_activated', testInfo);
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proAnimatedDP(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  await makeAccountPro({ user: alice, platform });
  await forceStopAndRestart(device);
  await device.dismissCTA();
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
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
      iOSContext: IOS_PRO_CONTEXT,
    });
  });
  const { alice1, bob1 } = devices;
  const { alice, bob } = prebuilt;
  await makeAccountPro({ user: alice, platform });
  await forceStopAndRestart(alice1);
  await alice1.dismissCTA();
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
