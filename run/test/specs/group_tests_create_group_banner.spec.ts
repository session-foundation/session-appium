import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { LatestReleaseBanner } from './locators/groups';
import { PlusButton } from './locators/home';
import { CreateGroupOption } from './locators/start_conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Create group banner',
  risk: 'high',
  testCb: createGroupBanner,
  countOfDevicesNeeded: 2,
});
async function createGroupBanner(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
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
