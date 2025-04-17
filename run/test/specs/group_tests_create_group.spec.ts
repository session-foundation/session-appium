import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { Contact } from './locators/global';
import { CreateGroupButton, GroupNameInput } from './locators/groups';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { sortByPubkey } from './utils/get_account_id';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt('Create group', 'high', groupCreation);

async function groupCreation(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userOne, userTwo, userThree] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);

  const userAMessage = `${userOne.userName} to ${testGroupName}`;
  const userBMessage = `${userTwo.userName} to ${testGroupName}`;
  const userCMessage = `${userThree.userName} to ${testGroupName}`;
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
  await device1.inputText(testGroupName, new GroupNameInput(device1));
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
      text: testGroupName,
    }),
    device3.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: testGroupName,
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
  await closeApp(device1, device2, device3);
}
