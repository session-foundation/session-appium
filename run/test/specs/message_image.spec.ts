import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DownloadMediaButton } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Send image 1:1', 'high', sendImageIos);
androidIt('Send image 1:1', 'high', sendImageAndroid);

async function sendImageIos(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = "Ron Swanson doesn't like birthdays";

  await newContact(platform, device1, userA, device2, userB);
  await device1.sendImage(platform, testMessage);
  await device2.clickOnByAccessibilityID('Untrusted attachment message');
  await sleepFor(500);
  // User B - Click on 'download'
  await device2.clickOnElementAll(new DownloadMediaButton(device2));
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
  // Close app and server
  await closeApp(device1, device2);
}

async function sendImageAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = 'Sending image from Alice to Bob';
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // Send test image to bob from Alice (device 1)
  await device1.sendImageWithMessageAndroid(testMessage);
  // Trust message on device 2 (bob)
  await device2.clickOnByAccessibilityID('Untrusted attachment message');
  // User B - Click on 'download'
  await device2.clickOnElementAll(new DownloadMediaButton(device2));
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Reply to message (on device 2 - Bob)
  const replyMessage = await device2.replyToMessage(userA, testMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app and server
  await closeApp(device1, device2);
}
