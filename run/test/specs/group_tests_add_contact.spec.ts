import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { EditGroup, InviteContactsButton, InviteContactsMenuItem } from './locators';
import { Contact } from './locators/global';
import { InviteContactConfirm } from './locators/groups';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppFourDevices } from './utils/open_app';

bothPlatformsIt('Add contact to group', 'high', addContactToGroup);
// TODO NEED TO UPDATE FOR IOS
async function addContactToGroup(platform: SupportedPlatformsType) {
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  const testGroupName = 'Group to test adding contact';
  const group = await createGroup(
    platform,
    device1,
    userA,
    device2,
    userB,
    device3,
    userC,
    testGroupName
  );
  const userD = await newUser(device4, USERNAME.DRACULA);
  await device1.navigateBack();
  await newContact(platform, device1, userA, device4, userD);
  // Exit to conversation list
  await device1.navigateBack();
  // Select group conversation in list
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: group.userName,
  });
  // Click more options
  await device1.clickOnByAccessibilityID('More options');
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
  await device4.selectByText('Conversation list item', group.userName);
  // Check for control message on device 4
  await device4.waitForControlMessageToBePresent(englishStripped('groupInviteYou').toString());
  await closeApp(device1, device2, device3, device4);
}
