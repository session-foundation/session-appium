import type { TestInfo } from '@playwright/test';

import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { InviteContactsMenuItem } from '../locators';
import {
  CommunityInvitation,
  CommunityInviteConfirmButton,
  ConversationSettings,
} from '../locators/conversation';
import { GroupMember } from '../locators/groups';
import { ConversationItem } from '../locators/home';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { sleepFor } from '../utils';
import { joinCommunity } from '../utils/community';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';
import { setDisappearingMessage } from '../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing community invite message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  testCb: disappearingCommunityInviteMessage,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription:
    'Verifies that a community invite disappears as expected in a 1:1 conversation',
});

// Interacting with communities can be a bit fickle so we give this a bit more time
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';
const maxWait = 65_000; // 60s plus buffer

async function disappearingCommunityInviteMessage(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // await alice1.navigateBack();
  await alice1.navigateBack();
  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await sleepFor(1000);
  await alice1.clickOnElementAll(new InviteContactsMenuItem(alice1));
  await alice1.clickOnElementAll(new GroupMember(alice1).build(bob.userName));
  await alice1.clickOnElementAll(new CommunityInviteConfirmButton(alice1));
  // The community invite process fails silently so we will check if the invite came through first
  await bob1.waitForTextElementToBePresent(new CommunityInvitation(bob1));
  const communityInviteTimestamp = Date.now();
  // Bob already has the convo open so we can start checking for the disappearing message immediately
  await bob1.hasElementDisappeared({
    ...new CommunityInvitation(bob1).build(),
    maxWait,
    actualStartTime: communityInviteTimestamp,
  });
  // Leave Invite Contacts, Conversation Settings, Community, and open convo with Bob
  await alice1.navigateBack();
  await alice1.navigateBack();
  await alice1.onIOS().navigateBack(); // Android only needs to go back twice
  await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
  // At this point the invite should have disappeared already so we just check it's not there
  await alice1.verifyElementNotPresent(new CommunityInvitation(alice1));
  await closeApp(alice1, bob1);
}
