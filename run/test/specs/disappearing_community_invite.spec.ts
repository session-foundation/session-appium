import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { InviteContactsMenuItem } from './locators';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { testCommunityLink, testCommunityName } from './../../constants/community';
import { ConversationSettings } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { GroupMember } from './locators/groups';
import type { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Disappearing community invite message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingCommunityInviteMessageIos,
    shouldSkip: false,
  },
  android: {
    testCb: disappearingCommunityInviteMessageAndroid,
    shouldSkip: false,
  },
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingCommunityInviteMessageIos(
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
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Invite contacts button',
  });
  // Check device 2 for invitation from user A
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
  // Wait for 30 seconds for message to disappear
  await sleepFor(30000);
  await Promise.all([
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testCommunityName,
    }),
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testCommunityName,
    }),
  ]);
  await closeApp(alice1, bob1);
}

async function disappearingCommunityInviteMessageAndroid(
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

  await alice1.navigateBack();
  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await sleepFor(1000);
  await alice1.clickOnElementAll(new InviteContactsMenuItem(alice1));
  await alice1.clickOnElementAll(new GroupMember(alice1).build(bob.userName));
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'invite-contacts-button',
  });
  // Check device 2 for invitation from user A
  await bob1.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/openGroupTitleTextView',
    text: testCommunityName,
  });
  // Wait for 30 seconds for message to disappear
  await sleepFor(30000);
  await bob1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testCommunityName,
  });
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testCommunityName,
  });
  await closeApp(alice1, bob1);
}
