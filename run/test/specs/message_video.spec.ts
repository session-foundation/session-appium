import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DownloadMediaButton } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Send video 1:1', 'medium', sendVideoIos);
androidIt('Send video 1:1', 'medium', sendVideoAndroid);

async function sendVideoIos(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  // create user a and user b
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const testMessage = 'Testing-video-1';
  // create contact
  await newContact(platform, device1, userA, device2, userB);
  // Push image to device for selection
  // Click on attachments button
  await device1.sendVideoiOS(testMessage);
  // Check if the 'Tap to download media' config appears
  // User B - Click on untrusted attachment message
  await device2.clickOnByAccessibilityID('Untrusted attachment message', 15000);
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

async function sendVideoAndroid(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  // create user a and user b
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const replyMessage = `Replying to video from ${userA.userName}`;
  // create contact
  await newContact(platform, device1, userA, device2, userB);
  // Send video
  await device1.sendVideoAndroid();
  // User B - Click on untrusted attachment message
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Untrusted attachment message',
    maxWait: 10000,
  });
  // User B - Click on 'download'
  await device2.clickOnElementAll(new DownloadMediaButton(device2));
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/play_overlay',
  });
  await device2.longPress('Media message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await sleepFor(2000);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app and server
  await closeApp(device1, device2);
}
