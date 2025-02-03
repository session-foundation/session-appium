import { englishStripped } from '../../../localizer/i18n/localizedString';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { Group, GROUPNAME, User } from '../../../types/testing';
import { newContact } from './create_contact';
import { SupportedPlatformsType } from './open_app';

export const createGroup = async (
  platform: SupportedPlatformsType,
  device1: DeviceWrapper,
  userOne: User,
  device2: DeviceWrapper,
  userTwo: User,
  device3: DeviceWrapper,
  userThree: User,
  userName: GROUPNAME
): Promise<Group> => {
  const group: Group = { userName, userOne, userTwo, userThree };

  const userAMessage = `${userOne.userName} to ${userName}`;
  const userBMessage = `${userTwo.userName} to ${userName}`;
  const userCMessage = `${userThree.userName} to ${userName}`;
  // Create contact between User A and User B
  await newContact(platform, device1, userOne, device2, userTwo);
  await device1.navigateBack();
  await newContact(platform, device1, userOne, device3, userThree);
  await device2.navigateBack();
  // Create contact between User A and User C
  // Exit conversation back to list
  await device1.navigateBack();
  // Exit conversation back to list
  await device3.navigateBack();
  // Click plus button
  await device1.clickOnByAccessibilityID('New conversation button');
  // Select Closed Group option
  await device1.clickOnByAccessibilityID('Create group');
  // Type in group name
  await device1.inputText(userName, { strategy: 'accessibility id', selector: 'Group name input' });
  // Select User B and User C
  await device1.selectByText('Contact', userTwo.userName);
  await device1.selectByText('Contact', userThree.userName);
  // Select tick
  await device1.clickOnByAccessibilityID('Create group');
  // Check for empty state on ios
  // Enter group chat on device 2 and 3
  await Promise.all([
    device2.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: group.userName,
    }),
    device3.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: group.userName,
    }),
  ]);
  if (platform === 'ios') {
    await device1.waitForLoadingOnboarding();
    await Promise.all([
      device1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Empty list',
        maxWait: 5000,
      }),
      device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Empty list',
        maxWait: 5000,
      }),
      device3.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Empty list',
        maxWait: 5000,
      }),
    ]);
  }
  // TODO: need to change once Android have updated their control messages
  const groupNoMessages = englishStripped('groupNoMessages')
    .withArgs({ group_name: group.userName })
    .toString();
  if (platform === 'android') {
    await device1.waitForControlMessageToBePresent(groupNoMessages);
    const legacyGroupMemberYouNew = englishStripped('legacyGroupMemberYouNew').toString();
    // Check control message 'You joined the group'
    await Promise.all([
      device2.waitForControlMessageToBePresent(legacyGroupMemberYouNew),
      device3.waitForControlMessageToBePresent(legacyGroupMemberYouNew),
    ]);
  }
  // Send message from User A to group to verify all working
  await device1.sendMessage(userAMessage);
  // Did the other devices receive UserA's message?
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userAMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userAMessage,
    }),
  ]);
  // Send message from User B to group
  await device2.sendMessage(userBMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userBMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userBMessage,
    }),
  ]);
  // Send message to User C to group
  await device3.sendMessage(userCMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userCMessage,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: userCMessage,
    }),
  ]);
  return { userName, userOne, userTwo, userThree };
};
