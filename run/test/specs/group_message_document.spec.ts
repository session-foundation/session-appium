import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DocumentMessage, MessageBody } from './locators/conversation';
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
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Message types',
  },
  allureDescription:
    'Verifies that a PDF can be sent to a group, all members receive the document, and replying to a document works as expected',
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
  await bob1.longPressMessage(new MessageBody(bob1, testMessage));
  await bob1.clickOnByAccessibilityID('Reply to message');
  await sleepFor(500); // Let the UI settle before finding message input and typing
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
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new DocumentMessage(device))
    )
  );
  // Reply to image - user B
  // Sleep for is waiting for image to load
  await sleepFor(1000);
  await bob1.longPressMessage(new DocumentMessage(bob1));
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
