import { longText } from '../../constants';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send long message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendLongMessageIos,
  },
  android: {
    testCb: sendLongMessageAndroid,
  },
});

async function sendLongMessageIos(platform: SupportedPlatformsType) {
  // Sending a long text message
  // Open device and server
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  // Send a long message from User A to User B
  await device1.sendMessage(longText);
  // Reply to message (User B to User A)
  const sentMessage = await device2.replyToMessage(userA, longText);
  // Check reply came through on device1
  await device1.findMessageWithBody(sentMessage);
  // Close app
  await closeApp(device1, device2);
}

async function sendLongMessageAndroid(platform: SupportedPlatformsType) {
  // Sending a long text message
  // Open device and server
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  // Send a long message from User A to User B
  await device1.sendMessage(longText);
  // Reply to message (User B to User A)
  const sentMessage = await device2.replyToMessage(userA, longText);
  // Check reply came through on device1
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Close app
  await closeApp(device1, device2);
}
