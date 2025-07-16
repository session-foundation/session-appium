import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
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
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing community invite message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  testCb: disappearingCommunityInviteMessage,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that a community invite disappears as expected in a 1:1 conversation`,
});

// Interacting with communities can be a bit fickle so we give this a bit more time
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';
const maxWait = 61_000; // 60s plus buffer

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
  // Leave Invite Contacts, Conversation Settings, Community, and open convo with Bob
  await alice1.navigateBack();
  await alice1.navigateBack();
  await alice1.navigateBack();
  await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
  // Wait for message to disappear
  await Promise.all(
    [alice1, bob1].map(device =>
      device.hasElementBeenDeleted({
        ...new CommunityInvitation(device).build(),
        maxWait,
      })
    )
  );
  await closeApp(alice1, bob1);
}
