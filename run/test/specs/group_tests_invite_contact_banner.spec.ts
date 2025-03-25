import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { createGroup } from './utils/create_group';
import { ConversationSettings } from './locators/conversation';
import { EditGroup, InviteContactsButton } from './locators';
import { LatestReleaseBanner } from './locators/groups';

bothPlatformsIt('Invite contacts banner', 'medium', inviteContactGroupBanner);

async function inviteContactGroupBanner(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create group
  const testGroupName = 'Test group';
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  // Navigate to Invite Contacts screen
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new EditGroup(device1));
  await device1.clickOnElementAll(new InviteContactsButton(device1));
  const groupsBanner = await device1.doesElementExist(new LatestReleaseBanner(device1));
  if (!groupsBanner) {
    throw new Error('v2 groups warning banner is not shown or text is incorrect');
  }
  await closeApp(device1, device2, device3);
}
