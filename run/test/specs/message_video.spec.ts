import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send video 1:1',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendVideoIos,
  },
  android: {
    testCb: sendVideoAndroid,
  },
});

async function sendVideoIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Testing-video-1';

  // Push image to device for selection
  // Click on attachments button
  await alice1.sendVideoiOS(testMessage);
  // Check if the 'Tap to download media' config appears
  // User B - Click on untrusted attachment message
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, testMessage));
  const replyMessage = await bob1.replyToMessage(alice, testMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app and server
  await closeApp(alice1, bob1);
}

async function sendVideoAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to video from ${alice.userName}`;
  // Send video
  await alice1.sendVideoAndroid();
  // User B - Click on untrusted attachment message
  await bob1.trustAttachments(alice.userName);
  await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger.qa:id/play_overlay',
  });
  await bob1.longPress('Media message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await sleepFor(2000);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app and server
  await closeApp(alice1, bob1);
}
