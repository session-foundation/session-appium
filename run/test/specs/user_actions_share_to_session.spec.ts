import type { TestInfo } from '@playwright/test';

import { testImage } from '../../constants/testfiles';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ImageName, MediaMessageInput, SendMediaButton, ShareExtensionIcon } from './locators';
import { PhotoLibrary } from './locators/external';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { handlePhotosFirstTimeOpen } from './utils/handle_first_open';
import { SupportedPlatformsType } from './utils/open_app';

// TODO investigate why the Android Photos app throws an unexpected error when sharing
bothPlatformsItSeparate({
  title: 'Share to session',
  risk: 'low',
  ios: {
    testCb: shareToSession,
  },
  android: {
    testCb: shareToSession,
    shouldSkip: true,
  },
  countOfDevicesNeeded: 2,
});

async function shareToSession(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Testing sharing an image through photo gallery to Session';

  // Need to make sure contact is confirm before moving away from Session
  await sleepFor(1000);
  await alice1.pressHome();
  await sleepFor(2000);
  await alice1.pushMediaToDevice(testImage);
  //  Photo app is on different page than Session
  await alice1.onIOS().swipeRightAny('Session');
  await alice1.clickOnElementAll(new PhotoLibrary(alice1));
  await sleepFor(2000);
  if (platform === 'ios') {
    // first launch of Photos app on iOS shows a 'What's New' screen
    await handlePhotosFirstTimeOpen(alice1);
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
  await alice1.inputText(testMessage, new MediaMessageInput(alice1));
  await alice1.clickOnElementAll(new SendMediaButton(alice1));
  // Loading screen...
  // TODO: On iOS, reset Photos UI state for alice1 (e.g. deselect, back out) after test runs
  // Currently skipping cleanup—future flake risk if Photos is left in selection mode
  await alice1.waitForLoadingOnboarding();
  // Check Bob's device
  await bob1.trustAttachments(USERNAME.ALICE);
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
}
