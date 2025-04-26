import { bothPlatformsIt } from '../../types/sessionIt';
import { PlusButton } from './locators/home';
import { CreateGroupOption } from './locators/start_conversation';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { LatestReleaseBanner } from './locators/groups';
import { open_Alice1_Bob1_friends } from './state_builder';

bothPlatformsIt({
  title: 'Create group banner',
  risk: 'high',
  testCb: createGroupBanner,
  countOfDevicesNeeded: 2,
});
async function createGroupBanner(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  await alice1.navigateBack();
  // Open the Create Group screen from home
  await alice1.clickOnElementAll(new PlusButton(alice1));
  await alice1.clickOnElementAll(new CreateGroupOption(alice1));
  const groupsBanner = await alice1.doesElementExist(new LatestReleaseBanner(alice1));
  if (!groupsBanner) {
    throw new Error('v2 groups warning banner is not shown or text is incorrect');
  }
  await closeApp(alice1, bob1);
}
