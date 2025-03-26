import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { PlusButton } from './locators/home';
import { CreateGroupOption } from './locators/start_conversation';
import { newUser } from './utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { newContact } from './utils/create_contact';
import { LatestReleaseBanner } from './locators/groups';

bothPlatformsIt('Create group banner', 'high', createGroupBanner);

async function createGroupBanner(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  // Create users A and B
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await device1.navigateBack();
  // Open the Create Group screen from home
  await device1.clickOnElementAll(new PlusButton(device1));
  await device1.clickOnElementAll(new CreateGroupOption(device1));
  const groupsBanner = await device1.doesElementExist(new LatestReleaseBanner(device1));
  if (!groupsBanner) {
    throw new Error('v2 groups warning banner is not shown or text is incorrect');
  }
  await closeApp(device1, device2);
}
