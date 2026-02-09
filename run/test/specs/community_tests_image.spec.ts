import { test, type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send image to community',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: sendImageCommunity,
  allureSuites: { parent: 'Sending Messages', suite: 'Message types' },
  allureDescription: 'Verifies that an image can be sent and received in a community',
});

async function sendImageCommunity(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
    });
  });
  const testImageMessage = `Image message + ${new Date().getTime()} - ${platform}`;
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await Promise.all(
      [alice1, bob1].map(device => joinCommunity(device, testCommunityLink, testCommunityName))
    );
  });
  await test.step(TestSteps.SEND.IMAGE, async () => {
    await alice1.sendImage(testImageMessage, true);
  });
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    await sleepFor(2000); // Give bob some time to receive the image
    await bob1.scrollToBottom();
    await bob1.onAndroid().trustAttachments(testCommunityName);
    await bob1.onAndroid().scrollToBottom(); // Trusting attachments scrolls the viewport up a bit so gotta scroll to bottom again
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, testImageMessage));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
