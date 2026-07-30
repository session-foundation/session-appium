import { test, type TestInfo } from '@playwright/test';

import { getCommunities } from '../../../constants/community';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationItem } from '../../locators/home';
import { open_Alice2 } from '../../state_builder';
import { joinCommunity } from '../../utils/community';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';

bothPlatformsIt({
  title: 'Join community test',
  risk: 'high',
  testCb: joinCommunityTest,
  countOfDevicesNeeded: 2,
  communityRooms: 1,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'Join Community',
  },
  allureDescription:
    'Verifies that joining a community works and the conversation syncs to a linked device',
});

async function joinCommunityTest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  const {
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice2({ platform, testInfo });
  });
  const testMessage = `Test message + ${new Date().getTime()}`;
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITY, async () => {
    await joinCommunity(alice1, communities.testCommunity.link, communities.testCommunity.name);
  });
  await test.step(
    TestSteps.SEND.MESSAGE(alice.userName, communities.testCommunity.name),
    async () => {
      await alice1.scrollToBottom();
      await alice1.sendMessage(testMessage);
    }
  );
  await test.step(TestSteps.VERIFY.MESSAGE_SYNCED, async () => {
    // Has community synced to device 2?
    await alice2.waitForTextElementToBePresent(
      new ConversationItem(alice2, communities.testCommunity.name)
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, alice2);
  });
}
