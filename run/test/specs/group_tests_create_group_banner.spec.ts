import type { TestInfo } from '@playwright/test';

import { androidIt } from '../../types/sessionIt';
import { LatestReleaseBanner } from './locators/groups';
import { PlusButton } from './locators/home';
import { CreateGroupOption } from './locators/start_conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

// This banner no longer exists on iOS
androidIt({
  title: 'Create group banner',
  risk: 'high',
  testCb: createGroupBanner,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Groups',
    suite: 'Create Group',
  },
  allureDescription:
    'Verifies that the latest release banner is present on the Create Group screen',
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
  // Verify the banner is present
  await alice1.waitForTextElementToBePresent(new LatestReleaseBanner(alice1));
  await closeApp(alice1, bob1);
}
