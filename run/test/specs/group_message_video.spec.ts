import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { MediaMessage, MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send video to group',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendVideoGroupiOS,
  },
  android: {
    testCb: sendVideoGroupAndroid,
  },
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Message types',
  },
  allureDescription:
    'Verifies that a video can be sent to a group, all members receive the document, and replying to a document works as expected',
});

async function sendVideoGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const testMessage = 'Testing-video-1';
  const replyMessage = `Replying to video from ${alice.userName} in ${testGroupName}`;
  await alice1.sendVideoiOS(testMessage);
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, testMessage))
    )
  );
  await bob1.longPressMessage(testMessage);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}

async function sendVideoGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Test sending a video
  // open devices
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to video from ${alice.userName} in ${testGroupName}`;
  // Click on attachments button
  await alice1.sendVideoAndroid();
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  // Check video appears in device 2 and device 3
  // (wait for loading animation to disappear and play icon to appear)
  // Device 2
  await Promise.all([
    bob1.waitForLoadingMedia(),
    bob1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Device 3
  await Promise.all([
    charlie1.waitForLoadingMedia(),
    charlie1.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Reply to message on device 2
  await bob1.longPress(new MediaMessage(bob1));
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  // Check reply appears in device 1 and device 3
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  // Close app and server
  await closeApp(alice1, bob1, charlie1);
}
