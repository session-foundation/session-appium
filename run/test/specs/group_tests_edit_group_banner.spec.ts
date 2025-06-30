import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { ConversationSettings } from './locators/conversation';
import { LatestReleaseBanner, ManageMembersMenuItem } from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import type { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Edit group banner',
  risk: 'medium',
  testCb: editGroupBanner,
  countOfDevicesNeeded: 3,
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
  const groupsBanner = await alice1.doesElementExist(new LatestReleaseBanner(alice1));
  if (!groupsBanner) {
    throw new Error('v2 groups warning banner is not shown or text is incorrect');
  }
  await closeApp(alice1, bob1, charlie1);
}
