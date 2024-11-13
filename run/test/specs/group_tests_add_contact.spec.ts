import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt,} from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ApplyChanges, EditGroup, InviteContactsButton, InviteContactsMenuItem } from './locators';
import { runOnlyOnAndroid, runOnlyOnIOS, sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppFourDevices } from './utils/open_app';

bothPlatformsIt('Add contact to group', 'high', addContactToGroup);

async function addContactToGroup(platform: SupportedPlatformsType) {
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
    newUser(device3, USERNAME.CHARLIE, platform),
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
  const userD = await newUser(device4, USERNAME.DRACULA, platform);
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
  await device1.clickOnElementAll(new InviteContactsMenuItem(device1));
  // Select new user
  const addedContact = await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userD.userName,
  });
  if (!addedContact && platform === 'android') {
    await device1.navigateBack();
    await device1.clickOnElementAll(new InviteContactsButton(device1));
    await device1.selectByText('Contact', userD.userName);
  }
  // Click done/apply
  await device1.clickOnByAccessibilityID('Done');
  // Click done/apply again
  await sleepFor(1000);
  await device1.clickOnElementAll(new ApplyChanges(device1));
  // Check control message
  // "legacyGroupMemberNew": "<b>{name}</b> joined the group.",
  const legacyGroupMemberNew = englishStripped('legacyGroupMemberNew')
    .withArgs({ name: userD.userName })
    .toString();

  await device1.waitForControlMessageToBePresent(legacyGroupMemberNew);
  // await Promise.all([
  //   device1.waitForControlMessageToBePresent(`${userD.userName} joined the group.`),
  // device2.waitForControlMessageToBePresent(`${userD.accountID} joined the group.`),
  // device3.waitForControlMessageToBePresent(`${userD.accountID} joined the group.`),
  // ]);
  await device4.navigateBack();
  await device4.selectByText('Conversation list item', group.userName);
  // Check control message on device 2 and 3
  // Check for control message on device 4 (iOS doesn't support You)
  await runOnlyOnIOS(platform, () =>
    device4.waitForControlMessageToBePresent(legacyGroupMemberNew)
  );
  // Android supports You
  // "legacyGroupMemberYouNew": "<b>You</b> joined the group.",
  const legacyGroupMemberYouNew = englishStripped('legacyGroupMemberYouNew').toString();
  await runOnlyOnAndroid(platform, () =>
    device4.waitForControlMessageToBePresent(legacyGroupMemberYouNew)
  );

  await closeApp(device1, device2, device3, device4);
}
