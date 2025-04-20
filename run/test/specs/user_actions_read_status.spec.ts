import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt('Read status', 'medium', readStatus);

async function readStatus(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA, userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const testMessage = 'Testing read status';
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
