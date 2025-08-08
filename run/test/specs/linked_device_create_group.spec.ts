import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationHeaderName, ConversationSettings } from './locators/conversation';
import {
  EditGroupNameInput,
  SaveGroupNameChangeButton,
  UpdateGroupInformation,
} from './locators/groups';
import { open_Alice2_Bob1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Group name change syncs',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: linkedGroup,
});

async function linkedGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Linked device group';
  const newGroupName = 'New group name';
  const {
    devices: { alice1, alice2, bob1 },
  } = await open_Alice2_Bob1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Edit group
  await sleepFor(100);
  // click on group name to change it
  await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
  //  Check new dialog
  await alice1.checkModalStrings(
    englishStrippedStr('updateGroupInformation').toString(),
    englishStrippedStr('updateGroupInformationDescription').toString()
  );
  // Delete old name first
  await alice1.deleteText(new EditGroupNameInput(alice1));
  // Type in new group name
  await alice1.inputText(newGroupName, new EditGroupNameInput(alice1));
  // Save changes
  await alice1.clickOnElementAll(new SaveGroupNameChangeButton(alice1));
  // Go back to conversation
  await alice1.navigateBack();
  // Check control message for changed name
  const groupNameNew = englishStrippedStr('groupNameNew')
    .withArgs({ group_name: newGroupName })
    .toString();
  // Control message should be "Group name is now {group_name}."
  await alice1.waitForControlMessageToBePresent(groupNameNew);
  // Check linked device for name change (conversation header name)
  await alice2.waitForTextElementToBePresent(
    new ConversationHeaderName(alice2).build(newGroupName)
  );
  await Promise.all(
    [alice1, alice2, bob1].map(device =>
      device.waitForTextElementToBePresent(new ConversationHeaderName(device).build(newGroupName))
    )
  );
  await Promise.all(
    [alice2, bob1].map(device => device.waitForControlMessageToBePresent(groupNameNew))
  );
  await closeApp(alice1, alice2, bob1);
}

// async function linkedGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
//   const testGroupName = 'Test group';
//   const newGroupName = 'Changed group name';
//   const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
//   // Create users A, B and C
//   const alice = await linkedDevice(device1, device2, USERNAME.ALICE);
//   const [bob, charlie] = await Promise.all([
//     newUser(device3, USERNAME.BOB),
//     newUser(device4, USERNAME.CHARLIE),
//   ]);
//   // Create group
//   // Note we keep this createGroup here as we want it to **indeed** use the UI to create the group
//   await createGroup(platform, device1, alice, device3, bob, device4, charlie, testGroupName);
//   // Test that group has loaded on linked device
//   await device2.clickOnElementAll(new ConversationItem(device2, testGroupName));
//   // Click on settings or three dots
//   await device1.clickOnElementAll(new ConversationSettings(device1));
//   // Click on Edit group option
//   await sleepFor(1000);
//   await device1.clickOnElementAll(new UpdateGroupInformation(device1));
//   // Click on current group name
//   await device1.clickOnElementAll(new EditGroupNameInput(device1));
//   // Remove current group name
//   await device1.deleteText(new EditGroupNameInput(device1));
//   // Enter new group name (same test tag for both)
//   await device1.clickOnElementAll(new EditGroupNameInput(device1));
//   await device1.inputText(newGroupName, new EditGroupNameInput(device1));
//   // Click done/apply
//   await device1.clickOnElementAll(new SaveGroupNameChangeButton(device1));
//   await device1.navigateBack();
//   // Check control message for changed name
//   const groupNameNew = englishStrippedStr('groupNameNew')
//     .withArgs({ group_name: newGroupName })
//     .toString();
//   // Config message is "Group name is now {group_name}"
//   await device1.waitForControlMessageToBePresent(groupNameNew);
//   // Check linked device for name change (conversation header name)
//   await device2.waitForTextElementToBePresent(
//     new ConversationHeaderName(device2).build(newGroupName)
//   );
//   await Promise.all([
//     device2.waitForControlMessageToBePresent(groupNameNew),
//     device3.waitForControlMessageToBePresent(groupNameNew),
//     device4.waitForControlMessageToBePresent(groupNameNew),
//   ]);
//   await closeApp(device1, device2, device3, device4);
// }

// // TODO
// // Remove user
// //  Add user
// //  Disappearing messages
