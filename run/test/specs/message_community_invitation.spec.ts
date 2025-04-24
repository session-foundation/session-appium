import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { InviteContactsMenuItem } from './locators';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { testCommunityLink, testCommunityName } from './../../constants/community';
import { englishStripped } from '../../localizer/Localizer';
import { ConversationSettings } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';

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
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  // Join community on device 1
  // Click on plus button
  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await sleepFor(500);
  await device1.clickOnElementAll(new InviteContactsMenuItem(device1));
  await device1.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Invite contacts button',
  });
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
  await device2.checkModalStrings(
    englishStripped('communityJoin').toString(),
    englishStripped('communityJoinDescription')
      .withArgs({ community_name: testCommunityName })
      .toString()
  );
  await device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Join' });
  await device2.navigateBack();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testCommunityName,
  });
  await closeApp(device1, device2);
}

async function sendCommunityInviteMessageAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  // Join community
  await sleepFor(100);
  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  // Wait for community to load
  // Add user B to community
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new InviteContactsMenuItem(device1));
  await device1.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await device1.clickOnByAccessibilityID('Done');
  // Check device 2 for invitation from user A
  await device2.waitForTextElementToBePresent({
    strategy: 'id',
    selector: 'network.loki.messenger:id/openGroupTitleTextView',
    text: testCommunityName,
  });
  // Make sure invitation works
  await device2.clickOnElementAll({
    strategy: 'id',
    selector: 'network.loki.messenger:id/openGroupTitleTextView',
    text: testCommunityName,
  });
  await device2.checkModalStrings(
    englishStripped('communityJoin').toString(),
    englishStripped('communityJoinDescription')
      .withArgs({ community_name: testCommunityName })
      .toString(),
    true
  );
  await device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Join' });
  await device2.navigateBack();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testCommunityName,
  });
  await closeApp(device1, device2);
}
