import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { LinkPreview, LinkPreviewMessage } from './locators';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { OutgoingMessageStatusSent } from './locators/conversation';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import type { TestInfo } from '@playwright/test';

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
});

async function sendLinkGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';
  const testLink = `https://getsession.org/`;

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
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString()
  );
  await alice1.clickOnByAccessibilityID('Enable');
  // No preview on first send
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });
  // Send again for image
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  await alice1.waitForTextElementToBePresent(new LinkPreview(alice1));
  await alice1.clickOnByAccessibilityID('Send message button');
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testLink,
  });
  // Reply to link
  await bob1.longPressMessage(testLink);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await charlie1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
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
  const testLink = `https://getsession.org/`;
  // Send a link
  await alice1.inputText(testLink, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Accept dialog for link preview
  await alice1.checkModalStrings(
    englishStrippedStr('linkPreviewsEnable').toString(),
    englishStrippedStr('linkPreviewsFirstDescription').toString(),
    true
  );
  await alice1.clickOnByAccessibilityID('Enable');
  //wait for preview to generate
  await sleepFor(5000);
  // No preview on first send
  await alice1.clickOnByAccessibilityID('Send message button');
  await alice1.waitForTextElementToBePresent({
    ...new OutgoingMessageStatusSent(alice1).build(),
    maxWait: 20000,
  });
  await Promise.all([
    bob1.waitForTextElementToBePresent(new LinkPreviewMessage(bob1)),
    charlie1.waitForTextElementToBePresent(new LinkPreviewMessage(charlie1)),
  ]);
  await bob1.longPressMessage(testLink);
  await bob1.clickOnByAccessibilityID('Reply to message');
  const replyMessage = await bob1.sendMessage(`${alice.userName} message reply`);
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  await closeApp(alice1, bob1, charlie1);
}
