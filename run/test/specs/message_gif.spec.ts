import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send GIF 1:1',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendGifIos,
  },
  android: {
    testCb: sendGifAndroid,
  },
});

async function sendGifIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to GIF from ${alice.userName}`;
  await alice1.sendGIF();
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });
  await bob1.longPress('Media message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(alice1, bob1);
}

async function sendGifAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices and server
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to GIF from ${alice.userName}`;
  // Click on attachments button
  await alice1.sendGIF();
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await sleepFor(5000);
  await bob1.longPress('Media message');
  // Check reply came through on alice1
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app
  await closeApp(alice1, bob1);
}
