import { androidIt, iosIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { InviteContactsMenuItem } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { joinCommunity } from './utils/join_community';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { testCommunityLink, testCommunityName } from './../../constants/community';

iosIt('Disappearing community invite message 1o1', 'low', disappearingCommunityInviteMessage1o1Ios);
androidIt(
  'Disappearing community invite message 1o1',
  'low',
  disappearingCommunityInviteMessage1o1Android
);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingCommunityInviteMessage1o1Ios(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  // await device1.navigateBack();
  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.clickOnByAccessibilityID('More options');
  await sleepFor(1000);
  await device1.clickOnElementAll(new InviteContactsMenuItem(device1));
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await device1.clickOnByAccessibilityID('Done');
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

async function disappearingCommunityInviteMessage1o1Android(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create user A and user B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);

  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);

  await device1.navigateBack();
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.clickOnByAccessibilityID('More options');
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
