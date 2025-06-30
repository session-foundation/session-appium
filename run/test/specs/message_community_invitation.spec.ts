import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { InviteContactsMenuItem } from './locators';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { testCommunityLink, testCommunityName } from './../../constants/community';
import { ConversationSettings } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { ConversationItem } from './locators/home';
import { GroupMember } from './locators/groups';

bothPlatformsItSeparate({
  title: 'Send community invitation',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: sendCommunityInvitationIos,
  },
  android: {
    testCb: sendCommunityInviteMessageAndroid,
  },
});

async function sendCommunityInvitationIos(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  // Join community on device 1
  // Click on plus button
  await alice1.navigateBack();
  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await sleepFor(500);
  await alice1.clickOnElementAll(new InviteContactsMenuItem(alice1));
  await alice1.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: bob.userName,
  });
  await alice1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Invite contacts button',
  });
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
  await bob1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
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

async function sendCommunityInviteMessageAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  // Join community
  await sleepFor(100);
  await alice1.navigateBack();
  // Android (currently) needs a message to be present for the Contacts to show in "Invite Contacts"
  await alice1.sendNewMessage({ accountID: bob.sessionId }, 'Alice to Bob');
  await alice1.navigateBack();

  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  // Wait for community to load
  // Add user B to community
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
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
  // Make sure invitation works
  await bob1.clickOnElementAll({
    strategy: 'id',
    selector: 'network.loki.messenger:id/openGroupTitleTextView',
    text: testCommunityName,
  });
  await bob1.checkModalStrings(
    englishStrippedStr('communityJoin').toString(),
    englishStrippedStr('communityJoinDescription')
      .withArgs({ community_name: testCommunityName })
      .toString(),
    false
  );
  await bob1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Join' });
  await bob1.navigateBack();
  await bob1.waitForTextElementToBePresent(new ConversationItem(bob1, testCommunityName));
  await closeApp(alice1, bob1);
}
