import type { TestInfo } from '@playwright/test';

import { longText } from '../../constants';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from '../locators/conversation';
import { ConversationItem } from '../locators/home';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { sleepFor } from '../utils';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

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
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // Send a long message from User A to User B
  await alice1.sendMessage(longText);
  // Bob replies
  await bob1.longPressMessage(new MessageBody(bob1, longText));
  await bob1.clickOnByAccessibilityID('Reply to message');

  const replyMessage = `${bob.userName} replied to ${longText}`;
  await bob1.inputText(replyMessage, new MessageInput(bob1));
  await bob1.clickOnElementAll(new SendButton(bob1));

  // This is dumb. The CI doesn't scroll to bottom when ran through Github Actions.
  // If you start the emulators on the CI box yourself the test will pass. I have no idea why.
  if (process.env.GITHUB_ACTIONS) {
    await bob1.scrollToBottom();
  }

  await bob1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(bob1).build(),
    maxWait: 50000,
  });
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app
  await closeApp(alice1, bob1);
}
