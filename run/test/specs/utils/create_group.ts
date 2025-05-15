import { englishStrippedStr } from '../../../localizer/englishStrippedStr';
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
  userName: GROUPNAME,
  checkControlMessage?: boolean
): Promise<Group> => {
  const group: Group = { userName, userOne, userTwo, userThree };

  const aliceMessage = `${userOne.userName} to ${userName}`;
  const bobMessage = `${userTwo.userName} to ${userName}`;
  const charlieMessage = `${userThree.userName} to ${userName}`;
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
  if (checkControlMessage) {
    // Sort by account ID
    const [firstUser, secondUser] = sortByPubkey(userTwo, userThree);
    // TODO remove onIOS once Android have implemented pubkey sorting
    await Promise.all([
      device1
        .onIOS()
        .waitForControlMessageToBePresent(
          englishStrippedStr(`groupMemberNewTwo`)
            .withArgs({ name: firstUser, other_name: secondUser })
            .toString()
        ),
      device2.waitForControlMessageToBePresent(
        englishStrippedStr('groupInviteYouAndOtherNew')
          .withArgs({ other_name: userThree.userName })
          .toString()
      ),
      device3.waitForControlMessageToBePresent(
        englishStrippedStr('groupInviteYouAndOtherNew')
          .withArgs({ other_name: userTwo.userName })
          .toString()
      ),
    ]);
  }
  // Send message from User A to group to verify all working
  await device1.sendMessage(aliceMessage);
  // Did the other devices receive alice's message?
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: aliceMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: aliceMessage,
    }),
  ]);
  // Send message from User B to group
  await device2.sendMessage(bobMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: bobMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: bobMessage,
    }),
  ]);
  // Send message to User C to group
  await device3.sendMessage(charlieMessage);
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: charlieMessage,
    }),
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: charlieMessage,
    }),
  ]);
  return { userName, userOne, userTwo, userThree };
};
