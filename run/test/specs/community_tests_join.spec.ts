import { test, type TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationItem } from './locators/home';
import { open_Alice2 } from './state_builder';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Join community test',
  risk: 'high',
  testCb: joinCommunityTest,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
  allureDescription:
    'Verifies that joining a community works and the conversation syncs to a linked device',
});

async function joinCommunityTest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice2({ platform, testInfo });
  });
  const testMessage = `Test message + ${new Date().getTime()}`;
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(alice1, testCommunityLink, testCommunityName);
    await sleepFor(5000);
  });
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, testCommunityName), async () => {
    await alice1.scrollToBottom();
    await alice1.sendMessage(testMessage);
  });
  await test.step(TestSteps.VERIFY.MESSAGE_SYNCED, async () => {
    // Has community synced to device 2?
    await alice2.waitForTextElementToBePresent(new ConversationItem(alice2, testCommunityName));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2);
  });
}
