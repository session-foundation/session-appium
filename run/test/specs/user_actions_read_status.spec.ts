import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils/index';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Read status',
  risk: 'medium',
  testCb: readStatus,
  countOfDevicesNeeded: 2,
});

async function readStatus(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Testing read status';
  // Go to settings to turn on read status
  // Device 1
  await Promise.all([alice1.turnOnReadReceipts(), bob1.turnOnReadReceipts()]);
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: bob.userName,
  });
  // Send message from User A to User B to verify read status is working
  await alice1.sendMessage(testMessage);
  await sleepFor(100);
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: alice.userName,
  });
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Check read status on device 1
  await alice1.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/messageStatusTextView',
    text: 'Read',
  });

  await alice1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Read',
  });

  await closeApp(alice1, bob1);
}

// Typing indicators working
