import { englishStripped } from '../../localizer/i18n/localizedString';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup, EditGroupName } from './locators';
import { EditGroupNameInput } from './locators/groups';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppFourDevices } from './utils/open_app';

iosIt('Create group and change name syncs', 'high', linkedGroupiOS);
androidIt('Create group and change name syncs', 'high', linkedGroupAndroid);

async function linkedGroupiOS(platform: SupportedPlatformsType) {
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
  const [userB, userC] = await Promise.all([
    newUser(device3, USERNAME.BOB),
    newUser(device4, USERNAME.CHARLIE),
  ]);
  const testGroupName = 'Linked device group';
  const newGroupName = 'New group name';
  await createGroup(platform, device1, userA, device3, userB, device4, userC, testGroupName);
  // Test that group has loaded on linked device
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testGroupName,
  });
  // Test group name change syncs
  // Change group name in device 1
  // Click on settings/more info
  await device1.clickOnByAccessibilityID('More options');
  // Edit group
  await sleepFor(100);
  // await device1.clickOnElementAll(new EditGroup(device1));
  // click on group name to change it
  await device1.clickOnElementAll(new EditGroupName(device1));
  //  Check new dialog
  await device1.checkModalStrings(
    englishStripped(`groupInformationSet`).toString(),
    englishStripped(`groupNameVisible`).toString()
  );
  // Type in new name
  await device1.deleteText(new EditGroupNameInput(device1));
  await device1.inputText(newGroupName, new EditGroupNameInput(device1));
  // Save changes
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Save',
  });
  await device1.navigateBack();
  // If ios click back to match android (which goes back to conversation screen)
  // Check config message for changed name (different on ios and android)
  const groupNameNew = englishStripped('groupNameNew')
    .withArgs({ group_name: newGroupName })
    .toString();
  // Config message is "Group now is now {group_name}"
  await device1.waitForControlMessageToBePresent(groupNameNew);
  // Wait 5 seconds for name to update
  await sleepFor(5000);
  // Check linked device for name change (conversation header name)
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
    text: newGroupName,
  });
  await Promise.all([
    device2.waitForControlMessageToBePresent(groupNameNew),
    device3.waitForControlMessageToBePresent(groupNameNew),
    device4.waitForControlMessageToBePresent(groupNameNew),
  ]);
  await closeApp(device1, device2, device3, device4);
}

async function linkedGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const newGroupName = 'Changed group name';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  // Create users A, B and C
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
  const [userB, userC] = await Promise.all([
    newUser(device3, USERNAME.BOB),
    newUser(device4, USERNAME.CHARLIE),
  ]);
  // Create group
  await createGroup(platform, device1, userA, device3, userB, device4, userC, testGroupName);
  // Test that group has loaded on linked device
  await device2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testGroupName,
  });
  // Click on settings or three dots
  await device1.clickOnByAccessibilityID('More options');
  // Click on Edit group option
  await sleepFor(1000);
  await device1.clickOnElementAll(new EditGroup(device1));
  // Click on current group name
  await device1.clickOnElementAll(new EditGroupNameInput(device1));
  // Enter new group name (still same test tag for both)
  await device1.clickOnElementAll(new EditGroupNameInput(device1));
  await device1.inputText(newGroupName, new EditGroupNameInput(device1));
  // Click done/apply
  await device1.clickOnByAccessibilityID('Confirm');
  await device1.navigateBack(true);
  // Check control message for changed name
  const groupNameNew = englishStripped('groupNameNew')
    .withArgs({ group_name: newGroupName })
    .toString();
  // Config message is "Group now is now {group_name}"
  await device1.waitForControlMessageToBePresent(groupNameNew);
  // Check linked device for name change (conversation header name)
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation header name',
    text: newGroupName,
  });
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
