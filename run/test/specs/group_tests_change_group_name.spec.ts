import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { EditGroup, EditGroupName } from './locators';
import { EditGroupNameInput } from './locators/groups';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { ConversationSettings } from './locators/conversation';
import { SaveNameChangeButton } from './locators/settings';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';

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

async function changeGroupNameIos(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  // Click on settings or three dots
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Click on Edit group option
  await sleepFor(1000);
  // Click on current group name
  await alice1.clickOnElementAll(new EditGroupName(alice1));
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
    console.log('Save button disabled - no text input');
  } else {
    throw new Error('Save button should be disabled');
  }
  await alice1.clickOnByAccessibilityID('Cancel');
  // Enter new group name
  await alice1.clickOnElementAll(new EditGroupName(alice1));
  await alice1.deleteText(new EditGroupNameInput(alice1));
  await alice1.inputText(newGroupName, new EditGroupNameInput(alice1));
  // Click done/apply
  await alice1.clickOnElementAll(new SaveNameChangeButton(alice1));
  await alice1.navigateBack();
  await alice1.waitForControlMessageToBePresent(
    englishStrippedStr('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );
  await closeApp(alice1, bob1, charlie1);
}

async function changeGroupNameAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  // Click on settings or three dots
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Click on Edit group option
  await sleepFor(1000);
  await alice1.clickOnElementAll(new EditGroup(alice1));
  // Click on current group name
  await alice1.clickOnElementAll(new EditGroupName(alice1));
  // Enter new group name (same test tag for both name and input)
  await alice1.clickOnElementAll(new EditGroupName(alice1));
  await alice1.inputText(newGroupName, new EditGroupName(alice1));
  // Click done/apply
  await alice1.clickOnByAccessibilityID('Confirm');
  await alice1.navigateBack(true);
  // Check control message for changed name
  await alice1.waitForControlMessageToBePresent(
    englishStrippedStr('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );
  await closeApp(alice1, bob1, charlie1);
}
