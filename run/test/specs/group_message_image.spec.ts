import { androidIt, iosIt } from '../../types/sessionIt';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

iosIt('Send image to group', 'high', sendImageGroupiOS);
androidIt('Send image to group', 'high', sendImageGroupAndroid);

async function sendImageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const testMessage = 'Sending image to group';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  await device1.sendImage(platform, testMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: `Message sent status: Sent`,
    maxWait: 50000,
  });
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
  ]);
  const replyMessage = await device2.replyToMessage(userA, testMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
      maxWait: 5000,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
      maxWait: 5000,
    }),
  ]);
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function sendImageGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const testMessage = 'Testing image sending to groups';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  const replyMessage = `Replying to image from ${userA.userName}`;
  await device1.sendImage(platform, testMessage);
  // Wait for image to appear in conversation screen
  await sleepFor(500);
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
    }),
  ]);
  // Reply to image - user B
  // Sleep for is waiting for image to load
  await sleepFor(1000);
  await device2.longPress('Media message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  // Close server and devices
  await closeApp(device1, device2, device3);
}
