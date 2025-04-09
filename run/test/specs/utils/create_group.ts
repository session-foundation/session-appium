import { englishStripped } from '../../../localizer/Localizer';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { Group, GROUPNAME, User } from '../../../types/testing';
import { Contact } from '../locators/global';
import { CreateGroupButton, GroupNameInput } from '../locators/groups';
import { newContact } from './create_contact';
import { sortByPubkey } from './get_account_id';
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
  await device1.inputText(userName, new GroupNameInput(device1));
  // Select User B and User C
  await device1.clickOnElementAll({ ...new Contact(device1).build(), text: userTwo.userName });
  await device1.clickOnElementAll({ ...new Contact(device1).build(), text: userThree.userName });
  // Select tick
  await device1.clickOnElementAll(new CreateGroupButton(device1));
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
  // Sort by account ID
  const [firstUser, secondUser] = sortByPubkey(userTwo, userThree);
  // TODO remove onIOS once Android have implemented pubkey sorting
  await Promise.all([
    device1
      .onIOS()
      .waitForControlMessageToBePresent(
        englishStripped(`groupMemberNewTwo`)
          .withArgs({ name: firstUser, other_name: secondUser })
          .toString()
      ),
    device2.waitForControlMessageToBePresent(
      englishStripped('groupInviteYouAndOtherNew')
        .withArgs({ other_name: userThree.userName })
        .toString()
    ),
    device3.waitForControlMessageToBePresent(
      englishStripped('groupInviteYouAndOtherNew')
        .withArgs({ other_name: userTwo.userName })
        .toString()
    ),
  ]);

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
