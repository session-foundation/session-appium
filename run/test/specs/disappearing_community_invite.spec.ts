import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { InviteContactsMenuItem } from './locators';
import { sleepFor } from './utils';
import { joinCommunity } from './utils/join_community';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { testCommunityLink, testCommunityName } from './../../constants/community';
import { ConversationSettings } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';

iosIt('Disappearing community invite message 1:1', 'low', disappearingCommunityInviteMessageIos);
androidIt(
  'Disappearing community invite message 1:1',
  'low',
  disappearingCommunityInviteMessageAndroid
);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingCommunityInviteMessageIos(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // await device1.navigateBack();
  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await sleepFor(1000);
  await device1.clickOnElementAll(new InviteContactsMenuItem(device1));
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Invite contacts button',
  });
  // Check device 2 for invitation from user A
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Community invitation',
    text: testCommunityName,
  });
  // Wait for 30 seconds for message to disappear
  await sleepFor(30000);
  await Promise.all([
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testCommunityName,
    }),
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testCommunityName,
    }),
  ]);
  await closeApp(device1, device2);
}

async function disappearingCommunityInviteMessageAndroid(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });

  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);

  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await sleepFor(1000);
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
  // Wait for 30 seconds for message to disappear
  await sleepFor(30000);
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testCommunityName,
  });
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testCommunityName,
  });
  await closeApp(device1, device2);
}
