import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send image 1:1',
  risk: 'high',
  testCb: sendImage,
  countOfDevicesNeeded: 2,
});

async function sendImage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Sending image from Alice to Bob';

  // Send test image to bob from Alice (device 1)
  await alice1.sendImage(testMessage);
  // Trust message on device 2 (bob)
  await bob1.trustAttachments(alice.userName);
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, testMessage));
  // Reply to message (on device 2 - Bob)
  const replyMessage = await bob1.replyToMessage(bob, testMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app and server
  await closeApp(alice1, bob1);
}
