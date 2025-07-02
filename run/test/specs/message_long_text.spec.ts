import type { TestInfo } from '@playwright/test';

import { longText } from '../../constants';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send long message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendLongMessageIos,
  },
  android: {
    testCb: sendLongMessageAndroid,
  },
});

async function sendLongMessageIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Sending a long text message
  // Open device and server
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // Send a long message from User A to User B
  await alice1.sendMessage(longText);
  // Reply to message (User B to User A)
  const sentMessage = await bob1.replyToMessage(alice, longText);
  // The CI kept throwing a stale element error here so we leave the convo and come back
  await alice1.navigateBack();
  await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
  await sleepFor(1000);
  await alice1.findMessageWithBody(sentMessage);
  // Close app
  await closeApp(alice1, bob1);
}

async function sendLongMessageAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Sending a long text message
  // Open device and server
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // Send a long message from User A to User B
  await alice1.sendMessage(longText);
  // Reply to message (User B to User A)
  const sentMessage = await bob1.replyToMessage(alice, longText);
  // Check reply came through on alice1
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Close app
  await closeApp(alice1, bob1);
}
