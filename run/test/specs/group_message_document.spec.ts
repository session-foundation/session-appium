import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send document to group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendDocumentGroupiOS,
  },
  android: {
    testCb: sendDocumentGroupAndroid,
  },
});

async function sendDocumentGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  const testMessage = 'Testing documents';
  const replyMessage = `Replying to document from ${alice.userName}`;

  await alice1.sendDocument();
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, testMessage))
    )
  );
  await bob1.longPressMessage(testMessage);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  await closeApp(alice1, bob1, charlie1);
}

async function sendDocumentGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
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

  const replyMessage = `Replying to document from ${alice.userName} in ${testGroupName}`;
  await alice1.sendDocument();
  // Reply to message
  await sleepFor(1000);
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  // Check document appears in both device 2 and 3's screen
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Document',
    }),
    await charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Document',
    }),
  ]);
  // Reply to document from user B
  await bob1.longPress('Document');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  // Check reply from device 2 came through on alice1 and charlie1
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  // Close app and server
  await closeApp(alice1, bob1, charlie1);
}
