import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationHeaderName, ConversationSettings } from './locators/conversation';
import {
  EditGroupNameInput,
  SaveGroupNameChangeButton,
  UpdateGroupInformation,
} from './locators/groups';
import { ConversationItem } from './locators/home';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppFourDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Create group and change name syncs',
  risk: 'high',
  countOfDevicesNeeded: 4,
  ios: {
    testCb: linkedGroupiOS,
  },
  android: {
    testCb: linkedGroupAndroid,
  },
  allureSuites: {
    parent: 'Groups',
    suite: 'Create Group',
  },
  allureDescription:
    'Verifies that a group created on one device appears on a linked device, and that a group name change syncs to all members.',
});

async function linkedGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  const alice = await linkedDevice(device1, device2, USERNAME.ALICE);
  const [bob, charlie] = await Promise.all([
    newUser(device3, USERNAME.BOB),
    newUser(device4, USERNAME.CHARLIE),
  ]);
  const testGroupName = 'Linked device group';
  const newGroupName = 'New group name';
  // Note we keep this createGroup here as we want it to **indeed** use the UI to create the group
  await createGroup(platform, device1, alice, device3, bob, device4, charlie, testGroupName);
  // Test that group has loaded on linked device
  await device2.clickOnElementAll(new ConversationItem(device2, testGroupName));
  // Change group name in device 1
  // Click on settings/more info
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Edit group
  await sleepFor(100);
  // click on group name to change it
  await device1.clickOnElementAll(new UpdateGroupInformation(device1, testGroupName));
  //  Check new dialog
  await device1.checkModalStrings(
    tStripped('updateGroupInformation'),
    tStripped('updateGroupInformationDescription')
  );
  // Delete old name first
  await device1.deleteText(new EditGroupNameInput(device1));
  // Type in new group name
  await device1.inputText(newGroupName, new EditGroupNameInput(device1));
  // Save changes
  await device1.clickOnElementAll(new SaveGroupNameChangeButton(device1));
  // Go back to conversation
  await device1.navigateBack();
  // Check control message for changed name
  const groupNameNew = tStripped('groupNameNew', { group_name: newGroupName });
  // Control message should be "Group name is now {group_name}."
  await device1.waitForControlMessageToBePresent(groupNameNew);
  // Wait 5 seconds for name to update
  await sleepFor(5000);
  // Check linked device for name change (conversation header name)
  await device2.waitForTextElementToBePresent(new ConversationHeaderName(device2, newGroupName));
  await Promise.all([
    device2.waitForControlMessageToBePresent(groupNameNew),
    device3.waitForControlMessageToBePresent(groupNameNew),
    device4.waitForControlMessageToBePresent(groupNameNew),
  ]);
  await closeApp(device1, device2, device3, device4);
}

async function linkedGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  // Create users A, B and C
  const alice = await linkedDevice(device1, device2, USERNAME.ALICE);
  const [bob, charlie] = await Promise.all([
    newUser(device3, USERNAME.BOB),
    newUser(device4, USERNAME.CHARLIE),
  ]);
  // Create group
  // Note we keep this createGroup here as we want it to **indeed** use the UI to create the group
  await createGroup(platform, device1, alice, device3, bob, device4, charlie, testGroupName);
  // Test that group has loaded on linked device
  await device2.clickOnElementAll(new ConversationItem(device2, testGroupName));
  // Click on settings or three dots
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Click on Edit group option
  await sleepFor(1000);
  await device1.clickOnElementAll(new UpdateGroupInformation(device1));
  // Click on current group name
  await device1.clickOnElementAll(new EditGroupNameInput(device1));
  // Remove current group name
  await device1.deleteText(new EditGroupNameInput(device1));
  // Enter new group name (same test tag for both)
  await device1.clickOnElementAll(new EditGroupNameInput(device1));
  await device1.inputText(newGroupName, new EditGroupNameInput(device1));
  // Click done/apply
  await device1.clickOnElementAll(new SaveGroupNameChangeButton(device1));
  await device1.navigateBack();
  // Check control message for changed name
  const groupNameNew = tStripped('groupNameNew', { group_name: newGroupName });
  // Config message is "Group name is now {group_name}"
  await device1.waitForControlMessageToBePresent(groupNameNew);
  // Check linked device for name change (conversation header name)
  await device2.waitForTextElementToBePresent(new ConversationHeaderName(device2, newGroupName));
  await Promise.all([
    device2.waitForControlMessageToBePresent(groupNameNew),
    device3.waitForControlMessageToBePresent(groupNameNew),
    device4.waitForControlMessageToBePresent(groupNameNew),
  ]);
  await closeApp(device1, device2, device3, device4);
}

// TODO
// Remove user
//  Add user
//  Disappearing messages
