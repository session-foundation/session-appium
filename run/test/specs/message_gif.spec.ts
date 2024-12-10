import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Send GIF 1:1', 'medium', sendGifIos);
androidIt('Send GIF 1:1', 'medium', sendGifAndroid);

async function sendGifIos(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  const testMessage = 'Testing-GIF-1';
  await newContact(platform, device1, userA, device2, userB);
  await device1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  await device2.trustAttachments(userA.userName);
  // Reply to message
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  const replyMessage = await device2.replyToMessage(userA, testMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(device1, device2);
}

async function sendGifAndroid(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices and server
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testMessage = 'Test message with GIF';
  // create user a and user b
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  const replyMessage = `Replying to GIF from ${userA.userName}`;
  // create contact
  await newContact(platform, device1, userA, device2, userB);
  // Click on attachments button
  await device1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await device2.trustAttachments(userA.userName);
  // Reply to message
  await sleepFor(5000);
  await device2.longPress('Media message');
  // Check reply came through on device1
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app
  await closeApp(device1, device2);
}
