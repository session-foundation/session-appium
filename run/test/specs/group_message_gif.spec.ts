import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { MediaMessage, MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send GIF to group',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendGifGroupiOS,
  },
  android: {
    testCb: sendGifGroupAndroid,
  },
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Message types',
  },
  allureDescription:
    'Verifies that a GIF can be sent to a group, all members receive the document, and replying to a document works as expected',
});

async function sendGifGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });

  const replyMessage = `Replying to GIF from ${alice.userName}`;

  await alice1.sendGIF();
  await sleepFor(500);
  await Promise.all(
    [bob1, charlie1].map(device => device.waitForTextElementToBePresent(new MediaMessage(device)))
  );
  // Reply to image - user B
  // Sleep for is waiting for image to load
  await sleepFor(1000);
  await bob1.longPress(new MediaMessage(bob1));
  // Check reply came through on alice1
  await bob1.clickOnByAccessibilityID('Reply to message');
  await sleepFor(500); // Let the UI settle before finding message input and typing
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  await closeApp(alice1, bob1, charlie1);
}

async function sendGifGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  const replyMessage = `Replying to GIF from ${alice.userName}`;
  // Click on attachments button
  await alice1.sendGIF();
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  await Promise.all(
    [bob1, charlie1].map(device => device.waitForTextElementToBePresent(new MediaMessage(device)))
  );
  // Reply to image - user B
  // Sleep for is waiting for image to load
  await bob1.longPress(new MediaMessage(bob1));
  // Check reply came through on alice1
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  // Close app
  await closeApp(alice1, bob1, charlie1);
}
