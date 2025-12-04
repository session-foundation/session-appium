import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody, VoiceMessage } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send voice message 1:1',
  risk: 'high',
  testCb: sendVoiceMessage,
  countOfDevicesNeeded: 2,
});

async function sendVoiceMessage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to voice message from ${alice.userName}`;
  // Select voice message button to activate recording state
  await alice1.sendVoiceMessage();
  await sleepFor(500);
  await alice1.waitForTextElementToBePresent(new VoiceMessage(alice1));
  await bob1.trustAttachments(alice.userName);
  await sleepFor(500);
  await bob1.longPressMessage(new VoiceMessage(bob1));
  await bob1.clickOnByAccessibilityID('Reply to message');
  await sleepFor(500); // Let the UI settle before finding message input and typing
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  await closeApp(alice1, bob1);
}
