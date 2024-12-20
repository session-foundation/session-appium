import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Read status', 'medium', readStatus);

async function readStatus(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = 'Testing read status';
  await newContact(platform, device1, userA, device2, userB);
  // Go to settings to turn on read status
  // Device 1
  await Promise.all([device1.turnOnReadReceipts(), device2.turnOnReadReceipts()]);
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userB.userName,
  });
  // Send message from User A to User B to verify read status is working
  await device1.sendMessage(testMessage);
  await sleepFor(100);
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userA.userName,
  });
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Check read status on device 1
  await device1.onAndroid().waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/messageStatusTextView',
    text: 'Read',
  });

  await device1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message sent status: Read',
  });

  await closeApp(device1, device2);
}

// Typing indicators working
