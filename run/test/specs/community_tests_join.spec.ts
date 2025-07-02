import type { TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationItem } from './locators/home';
import { open_Alice2 } from './state_builder';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Join community test',
  risk: 'high',
  testCb: joinCommunityTest,
  countOfDevicesNeeded: 2,
});

async function joinCommunityTest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });
  const testMessage = `Test message + ${new Date().getTime()}`;

  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await sleepFor(5000);
  await alice1.scrollToBottom();
  await alice1.sendMessage(testMessage);
  // Has community synced to device 2?
  await alice2.waitForTextElementToBePresent(new ConversationItem(alice2, testCommunityName));
  await closeApp(alice1, alice2);
}
