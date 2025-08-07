import type { TestInfo } from '@playwright/test';

import { androidIt } from '../../types/sessionIt';
import { InviteContactsButton } from './locators';
import { ConversationSettings } from './locators/conversation';
import { LatestReleaseBanner, ManageMembersMenuItem } from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

// This banner no longer exists on iOS
androidIt({
  title: 'Invite contacts banner',
  risk: 'medium',
  testCb: inviteContactGroupBanner,
  countOfDevicesNeeded: 3,
});

async function inviteContactGroupBanner(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  // Navigate to Invite Contacts screen
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
  await alice1.clickOnElementAll(new InviteContactsButton(alice1));
  await alice1.waitForTextElementToBePresent(new LatestReleaseBanner(alice1));
  await closeApp(alice1, bob1, charlie1);
}
