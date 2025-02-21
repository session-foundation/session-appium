import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DownloadMediaButton } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Send voice message 1:1', 'high', sendVoiceMessage);

async function sendVoiceMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // create user a and user b
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const replyMessage = `Replying to voice message from ${userA.userName}`;
  await newContact(platform, device1, userA, device2, userB);
  // Select voice message button to activate recording state
  await device1.sendVoiceMessage();
  await sleepFor(500);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Voice message',
  });

  await device2.clickOnByAccessibilityID('Untrusted attachment message');
  await sleepFor(200);
  await device2.clickOnElementAll(new DownloadMediaButton(device2));
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
