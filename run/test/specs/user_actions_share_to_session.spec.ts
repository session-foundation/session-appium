import { test, type TestInfo } from '@playwright/test';

import { testImage } from '../../constants/testfiles';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ImageName, ShareExtensionIcon } from './locators';
import { MessageInput, SendButton } from './locators/conversation';
import { PhotoLibrary } from './locators/external';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { handlePhotosFirstTimeOpen } from './utils/handle_first_open';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Share to session',
  risk: 'medium',
  testCb: shareToSession,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Share to Session',
  },
  allureDescription: `Verifies that a user can share an image from the photo gallery to Session`,
});

async function shareToSession(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  const testMessage = 'Testing sharing an image through photo gallery to Session';
  await test.step('Leave Session and open Photos app', async () => {
    // Need to make sure contact is confirm before moving away from Session
    await sleepFor(1000);
    await alice1.pressHome();
    await sleepFor(2000);
    await alice1.pushMediaToDevice(testImage);
    //  Photo app is on different page than Session
    await alice1.onIOS().swipeRightAny('Session');
    await alice1.clickOnElementAll(new PhotoLibrary(alice1));
    await sleepFor(2000);
  });
  await test.step('Select image and share to Session', async () => {
    await handlePhotosFirstTimeOpen(alice1);
    if (platform === 'ios') {
      await alice1.clickOnByAccessibilityID('Select');
      await alice1.matchAndTapImage(
        { strategy: 'xpath', selector: `//XCUIElementTypeImage` },
        testImage
      );
    }
    await alice1.onAndroid().clickOnElementAll(new ImageName(alice1));
    await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Share' });
    await alice1.clickOnElementAll(new ShareExtensionIcon(alice1));
    await alice1.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Contact',
      text: USERNAME.BOB,
    });
    await alice1.inputText(testMessage, new MessageInput(alice1));
    await alice1.clickOnElementAll(new SendButton(alice1));
    // Loading screen...
    // TODO: On iOS, reset Photos UI state for alice1 (e.g. deselect, back out) after test runs
    // Currently skipping cleanup—future flake risk if Photos is left in selection mode
    await alice1.waitForLoadingOnboarding();
  });
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    await bob1.trustAttachments(USERNAME.ALICE);
    await bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    });
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
