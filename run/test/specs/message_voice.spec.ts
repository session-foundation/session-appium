import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
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
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const replyMessage = `Replying to voice message from ${userA.userName}`;
  // Select voice message button to activate recording state
  await device1.sendVoiceMessage();
  await sleepFor(500);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Voice message',
  });

  await device2.trustAttachments(userA.userName);
  await sleepFor(500);
  await device2.longPress('Voice message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);

  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(device1, device2);
}
