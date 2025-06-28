import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

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

async function sendGifIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Testing-GIF-1';
  await alice1.sendGIF(testMessage);
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
  // Close app
  await closeApp(alice1, bob1);
}

async function sendGifAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices and server
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Test message with GIF';

  const replyMessage = `Replying to GIF from ${alice.userName}`;
  // Click on attachments button
  await alice1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await sleepFor(5000);
  await bob1.longPress('Media message');
  // Check reply came through on alice1
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  // Close app
  await closeApp(alice1, bob1);
}
