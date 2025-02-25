import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup, EditGroupName } from './locators';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

iosIt('Change group name', 'medium', changeGroupNameIos);
androidIt('Change group name', 'medium', changeGroupNameAndroid);

async function changeGroupNameIos(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create group

  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Now change the group name

  // Click on settings or three dots
  await device1.clickOnByAccessibilityID('More options');
  // Click on Edit group option
  await sleepFor(1000);
  // Click on current group name
  await device1.clickOnElementAll(new EditGroupName(device1));
  await device1.checkModalStrings(
    englishStripped(`groupInformationSet`).toString(),
    englishStripped(`groupNameVisible`).toString()
  );
  await device1.deleteText({
    strategy: 'accessibility id',
    selector: 'Group name text field',
  });
  await device1.inputText('   ', {
    strategy: 'accessibility id',
    selector: 'Group name text field',
  });
  const saveButton = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Save',
  });
  const attr = await device1.getAttribute('value', saveButton.ELEMENT);
  if (attr !== 'enabled') {
    console.log('Save button disabled - no text input');
  }
  // Delete empty space
  await device1.clickOnByAccessibilityID('Cancel');

  // Enter new group name
  await device1.clickOnElementAll(new EditGroupName(device1));
  await device1.deleteText({
    strategy: 'accessibility id',
    selector: 'Group name text field',
  });

  await device1.inputText(newGroupName, {
    strategy: 'accessibility id',
    selector: 'Group name text field',
  });
  // Click done/apply
  await device1.clickOnByAccessibilityID('Save');
  await device1.navigateBack();
  await device1.waitForControlMessageToBePresent(
    englishStripped('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );
  await closeApp(device1, device2, device3);
}

async function changeGroupNameAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create group
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Click on settings or three dots
  await device1.clickOnByAccessibilityID('More options');
  // Click on Edit group option
  await sleepFor(1000);
  await device1.clickOnElementAll(new EditGroup(device1));
  // Click on current group name
  await device1.clickOnElementAll(new EditGroupName(device1));
  // Enter new group name (still same test tag for both)
  await device1.clickOnElementAll(new EditGroupName(device1));

  await device1.inputText(newGroupName, new EditGroupName(device1));
  // Click done/apply
  await device1.clickOnByAccessibilityID('Confirm');
  await device1.navigateBack(true);
  // Check control message for changed name (different on ios and android)
  await device1.waitForControlMessageToBePresent(
    englishStripped('groupNameNew').withArgs({ group_name: newGroupName }).toString()
  );

  await closeApp(device1, device2, device3);
}
