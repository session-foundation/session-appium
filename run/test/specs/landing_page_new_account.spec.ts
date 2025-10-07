import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';
import { verifyElementScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'Check landing page (new account) layout',
  risk: 'low',
  testCb: landingPageNewAccount,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Visual Checks',
    suite: 'Onboarding',
  },
  allureDescription: `Verifies that the landing page for a new account matches the expected baseline`,
});

async function landingPageNewAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE);
  // Verify that the party popper is shown on the landing page
  await verifyElementScreenshot(
    device,
    new EmptyLandingPageScreenshot(device),
    testInfo,
    'new_account'
  );
  await closeApp(device);
}
