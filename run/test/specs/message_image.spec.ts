import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send image 1:1',
  risk: 'high',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendImageIos,
  },
  android: {
    testCb: sendImageAndroid,
  },
});

async function sendImageIos(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = "Ron Swanson doesn't like birthdays";

  await alice1.sendImage(platform, testMessage);
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  const replyMessage = await bob1.replyToMessage(alice, testMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app and server
  await closeApp(alice1, bob1);
}

async function sendImageAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = 'Sending image from Alice to Bob';

  // Send test image to bob from Alice (device 1)
  await alice1.sendImageWithMessageAndroid(testMessage);
  // Trust message on device 2 (bob)
  await bob1.trustAttachments(alice.userName);
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Reply to message (on device 2 - Bob)
  const replyMessage = await bob1.replyToMessage(alice, testMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app and server
  await closeApp(alice1, bob1);
}
