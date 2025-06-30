import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import type { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Send image to community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendImageCommunityiOS,
    shouldSkip: true,
  },
  android: {
    testCb: sendImageCommunityAndroid,
    shouldSkip: true,
  },
});

// Tests skipped due to both platforms having unique issues, have made a ticket
// to investigate further https://optf.atlassian.net/browse/QA-486

async function sendImageCommunityiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false,
    testInfo,
  });
  const testMessage = 'Testing sending images to communities';
  const testImageMessage = `Image message + ${new Date().getTime()} - ${platform}`;

  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await joinCommunity(bob1, testCommunityLink, testCommunityName);
  await Promise.all([alice1.scrollToBottom(), bob1.scrollToBottom()]);
  await alice1.sendMessage(testMessage);
  await alice1.sendImage(testImageMessage, true);
  await bob1.replyToMessage(alice, testImageMessage);
  await closeApp(alice1, bob1);
}

async function sendImageCommunityAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1: alice1, device2: bob1 } = await openAppTwoDevices(platform, testInfo);
  const time = await alice1.getTimeFromDevice(platform);
  const testMessage = `Testing sending images to communities + ${time} - ${platform}`;
  // Create user A and user B
  const [Alice] = await Promise.all([newUser(alice1, USERNAME.ALICE), newUser(bob1, USERNAME.BOB)]);
  const replyMessage = `Replying to image from ${Alice.userName} in community ${testCommunityName} + ${time}`;
  await Promise.all([
    joinCommunity(alice1, testCommunityLink, testCommunityName),
    joinCommunity(bob1, testCommunityLink, testCommunityName),
  ]);

  await alice1.sendImage(testMessage, true);
  await bob1.scrollToBottom();
  await bob1.longPressMessage(testMessage);
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  await closeApp(alice1, bob1);
}
