import { androidIt, iosIt } from '../../types/sessionIt';
import { open3AppsWithFriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

iosIt('Send GIF to group', 'medium', sendGifGroupiOS);
androidIt('Send GIF to group', 'medium', sendGifGroupAndroid);

async function sendGifGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWithFriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });

  const testMessage = 'Testing-GIF-1';
  const replyMessage = `Replying to GIF from ${userA.userName}`;

  await device1.sendGIF(testMessage);
  await sleepFor(500);
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device2.longPressMessage(testMessage);
  // Check reply came through on device1
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(device1, device2, device3);
}

async function sendGifGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWithFriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  const testMessage = 'Testing-GIF-1';
  const replyMessage = `Replying to GIF from ${userA.userName}`;
  // Click on attachments button
  await device1.sendGIF(testMessage);
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  // Reply to message
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
    maxWait: 10000,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
    maxWait: 10000,
  });
  await device2.longPress('Media message');
  // Check reply came through on device1
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(device1, device2, device3);
}
