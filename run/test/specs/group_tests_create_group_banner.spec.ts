import { bothPlatformsIt } from '../../types/sessionIt';
import { PlusButton } from './locators/home';
import { CreateGroupOption } from './locators/start_conversation';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { LatestReleaseBanner } from './locators/groups';
import { open2AppsWithFriendsState } from './state_builder';

bothPlatformsIt('Create group banner', 'high', createGroupBanner);

async function createGroupBanner(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
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
