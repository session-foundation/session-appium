import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send video 1:1',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendVideoIos,
  },
  android: {
    testCb: sendVideoAndroid,
  },
});

async function sendVideoIos(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const testMessage = 'Testing-video-1';

  // Push image to device for selection
  // Click on attachments button
  await device1.sendVideoiOS(testMessage);
  // Check if the 'Tap to download media' config appears
  // User B - Click on untrusted attachment message
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
  // Close app and server
  await closeApp(device1, device2);
}

async function sendVideoAndroid(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const replyMessage = `Replying to video from ${userA.userName}`;
  // Send video
  await device1.sendVideoAndroid();
  // User B - Click on untrusted attachment message
  await device2.trustAttachments(userA.userName);
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
