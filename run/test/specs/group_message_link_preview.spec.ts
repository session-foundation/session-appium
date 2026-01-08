import type { TestInfo } from '@playwright/test';

import { testLink } from '../../constants';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { LinkPreview, LinkPreviewMessage } from './locators';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from './locators/conversation';
import { EnableLinkPreviewsModalButton } from './locators/global';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send link to group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendLinkGroupiOS,
  },
  android: {
    testCb: sendLinkGroupAndroid,
  },
  allureSuites: {
    parent: 'Sending Messages',
    suite: 'Message types',
  },
  allureDescription:
    'Verifies that a link with preview can be sent to a group, all members receive the document, and replying to a document works as expected',
});

async function sendLinkGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  const replyMessage = `Replying to link from ${alice.userName} in group ${testGroupName}`;
  // Create contact between User A and User B
  await alice1.inputText(testLink, new MessageInput(alice1));
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString()
  );
  await alice1.clickOnElementAll(new EnableLinkPreviewsModalButton(alice1));
  // No preview on first send
  await alice1.clickOnElementAll(new SendButton(alice1));
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });
  // Send again for image
  await alice1.inputText(testLink, new MessageInput(alice1));
  await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
  await alice1.clickOnElementAll(new SendButton(alice1));
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, testLink))
    )
  );
  // Reply to link
  await bob1.longPressMessage(new MessageBody(bob1, testLink));
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

async function sendLinkGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  // Send a link
  await alice1.inputText(testLink, new MessageInput(alice1));
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString()
  );
  await alice1.clickOnElementAll(new EnableLinkPreviewsModalButton(alice1));
  //wait for preview to generate
  await sleepFor(5000);
  // No preview on first send
  await alice1.clickOnElementAll(new SendButton(alice1));
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });
  await Promise.all([
    bob1.waitForTextElementToBePresent(new LinkPreviewMessage(bob1)),
    charlie1.waitForTextElementToBePresent(new LinkPreviewMessage(charlie1)),
  ]);
  await bob1.longPressMessage(new MessageBody(bob1, testLink));
  await bob1.clickOnByAccessibilityID('Reply to message');
  const replyMessage = `${alice.userName} message reply`;
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
