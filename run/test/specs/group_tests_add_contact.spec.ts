import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup, InviteContactsButton, InviteContactsMenuItem } from './locators';
import { ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import { InviteContactConfirm } from './locators/groups';
import { open4AppsWith3Friends1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Add contact to group',
  risk: 'high',
  testCb: addContactToGroup,
  countOfDevicesNeeded: 4,
});
async function addContactToGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Group to test adding contact';
  const {
    devices: { device1, device2, device3, device4 },
    prebuilt: { userA, group },
  } = await open4AppsWith3Friends1GroupState({
    platform,
    groupName: testGroupName,
  });
  const userD = await newUser(device4, USERNAME.DRACULA);
  await device1.navigateBack();
  await newContact(platform, device1, userA, device4, userD);
  // Exit to conversation list
  await device1.navigateBack();
  // Select group conversation in list
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: group.groupName,
  });
  // Click more options
  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Select edit group
  await device1.clickOnElementAll(new EditGroup(device1));
  await sleepFor(1000);
  // Add contact to group
  await device1.onIOS().clickOnElementAll(new InviteContactsMenuItem(device1));
  await device1.onAndroid().clickOnElementAll(new InviteContactsButton(device1));
  // Select new user
  await device1.clickOnElementAll({
    ...new Contact(device1).build(),
    text: USERNAME.DRACULA,
  });
  // Click done/apply
  await device1.clickOnElementAll(new InviteContactConfirm(device1));
  // Click done/apply again
  await device1.navigateBack(true);
  // iOS doesn't automatically go back to conversation settings
  await device1.onIOS().navigateBack();
  // Check control messages
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForControlMessageToBePresent(
        englishStripped('groupMemberNew').withArgs({ name: USERNAME.DRACULA }).toString()
      )
    )
  );
  await device4.navigateBack();
  await device4.selectByText('Conversation list item', group.groupName);
  // Check for control message on device 4
  await device4.waitForControlMessageToBePresent(englishStripped('groupInviteYou').toString());
  await closeApp(device1, device2, device3, device4);
}
