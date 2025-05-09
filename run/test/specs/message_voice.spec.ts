import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Send voice message 1:1',
  risk: 'high',
  testCb: sendVoiceMessage,
  countOfDevicesNeeded: 2,
});

async function sendVoiceMessage(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const replyMessage = `Replying to voice message from ${alice.userName}`;
  // Select voice message button to activate recording state
  await alice1.sendVoiceMessage();
  await sleepFor(500);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Voice message',
  });

  await bob1.trustAttachments(alice.userName);
  await sleepFor(500);
  await bob1.longPress('Voice message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);

  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(alice1, bob1);
}
