import type { TestInfo } from '@playwright/test';

import { androidIt } from '../../types/sessionIt';
import { ConversationSettings } from '../locators/conversation';
import { LatestReleaseBanner, ManageMembersMenuItem } from '../locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

// This banner no longer exists on iOS
androidIt({
  title: 'Edit group banner',
  risk: 'medium',
  testCb: editGroupBanner,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription: 'Verifies that the latest release banner is present on the Edit Group screen',
});

async function editGroupBanner(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  // Navigate to Edit Group screen
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
  await alice1.waitForTextElementToBePresent(new LatestReleaseBanner(alice1));
  await closeApp(alice1, bob1, charlie1);
}
