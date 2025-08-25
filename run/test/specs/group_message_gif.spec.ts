import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
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
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });
  await bob1.longPress('Media message');
  // Check reply came through on alice1
  await bob1.clickOnByAccessibilityID('Reply to message');
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
  // Reply to message
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
    maxWait: 10000,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
    maxWait: 10000,
  });
  await bob1.longPress('Media message');
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
