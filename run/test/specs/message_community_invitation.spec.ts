import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { testCommunityLink, testCommunityName } from './../../constants/community';
import { InviteContactsMenuItem } from './locators';
import {
  CommunityInvitation,
  CommunityInviteConfirmButton,
  ConversationSettings,
} from './locators/conversation';
import { GroupMember } from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send community invitation',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: sendCommunityInvitation,
});

async function sendCommunityInvitation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // Join community on device 1
  // Click on plus button
  await alice1.navigateBack();
  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await sleepFor(500);
  await alice1.clickOnElementAll(new InviteContactsMenuItem(alice1));
  await alice1.clickOnElementAll(new GroupMember(alice1).build(bob.userName));
  await alice1.clickOnElementAll(new CommunityInviteConfirmButton(alice1));
  await bob1.waitForTextElementToBePresent(new CommunityInvitation(bob1));
  await bob1.clickOnElementAll(new CommunityInvitation(bob1));
  await bob1.checkModalStrings(
    englishStrippedStr('communityJoin').toString(),
    englishStrippedStr('communityJoinDescription')
      .withArgs({ community_name: testCommunityName })
      .toString()
  );
  await bob1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Join' });
  await bob1.navigateBack();
  await bob1.waitForTextElementToBePresent(new ConversationItem(bob1, testCommunityName));
  await closeApp(alice1, bob1);
}
