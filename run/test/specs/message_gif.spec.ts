import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send GIF 1:1',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendGifIos,
  },
  android: {
    testCb: sendGifAndroid,
  },
});

async function sendGifIos(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = 'Testing-GIF-1';
  await device1.sendGIF(testMessage);
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
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = 'Test message with GIF';

  const replyMessage = `Replying to GIF from ${userA.userName}`;
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
