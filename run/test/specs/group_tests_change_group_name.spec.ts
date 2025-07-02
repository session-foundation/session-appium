import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import {
  EditGroupNameInput,
  SaveGroupNameChangeButton,
  UpdateGroupInformation,
} from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Change group name',
  risk: 'medium',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: changeGroupNameIos,
  },
  android: {
    testCb: changeGroupNameAndroid,
  },
});

async function changeGroupNameIos(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  // Click on settings or three dots
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Click on Edit group option
  await sleepFor(1000);
  // Click on current group name
  await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
  await alice1.checkModalStrings(
    englishStrippedStr(`updateGroupInformation`).toString(),
    englishStrippedStr(`updateGroupInformationDescription`).toString()
  );
  await alice1.deleteText(new EditGroupNameInput(alice1));
  await alice1.inputText('   ', new EditGroupNameInput(alice1));
  const saveButton = await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Save',
  });
  const attr = await alice1.getAttribute('value', saveButton.ELEMENT);
  if (attr !== 'enabled') {
    alice1.log('Save button disabled - no text input');
  } else {
    throw new Error('Save button should be disabled');
  }
  await alice1.clickOnByAccessibilityID('Cancel');
  // Enter new group name
  await alice1.clickOnElementAll(new UpdateGroupInformation(alice1, testGroupName));
  await alice1.deleteText(new EditGroupNameInput(alice1));
  await alice1.inputText(newGroupName, new EditGroupNameInput(alice1));
  // Click done/apply
  await alice1.clickOnElementAll(new SaveGroupNameChangeButton(alice1));
  await alice1.navigateBack();
  await alice1.waitForControlMessageToBePresent(
    englishStrippedStr('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );
  await closeApp(alice1, bob1, charlie1);
}

async function changeGroupNameAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  // Click on settings or three dots
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Click on Edit group option
  await sleepFor(1000);
  await alice1.clickOnElementAll(new UpdateGroupInformation(alice1));
  await alice1.clickOnElementAll(new EditGroupNameInput(alice1));
  await alice1.inputText(newGroupName, new EditGroupNameInput(alice1));
  // Click done/apply
  await alice1.clickOnElementAll(new SaveGroupNameChangeButton(alice1));
  await alice1.navigateBack();
  // Check control message for changed name
  await alice1.waitForControlMessageToBePresent(
    englishStrippedStr('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );
  await closeApp(alice1, bob1, charlie1);
}
