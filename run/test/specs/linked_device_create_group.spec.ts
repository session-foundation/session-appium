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
  await alice2.waitForTextElementToBePresent(new ConversationHeaderName(alice2, newGroupName));
  await Promise.all(
    [alice1, alice2, bob1].map(device =>
      device.waitForTextElementToBePresent(new ConversationHeaderName(device, newGroupName))
    )
  );
  await Promise.all(
    [alice2, bob1].map(device => device.waitForControlMessageToBePresent(groupNameNew))
  );
  await closeApp(alice1, alice2, bob1);
}