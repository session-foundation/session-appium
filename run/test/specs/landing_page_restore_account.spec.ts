import type { TestInfo } from '@playwright/test';

import { USERNAME } from '@session-foundation/qa-seeder';

import { bothPlatformsIt } from '../../types/sessionIt';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';
import { verifyElementScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'Check landing page (restored account) layout',
  risk: 'low',
  testCb: landingPageRestoreAccount,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Visual Checks',
    suite: 'Onboarding',
  },
  allureDescription: `Verifies that the landing page for a restored account matches the expected baseline`,
});

async function landingPageRestoreAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Creating a linked device is used as a shortcut to restore an account
  const { device1: alice1, device2: alice2 } = await openAppTwoDevices(platform, testInfo);
  await linkedDevice(alice1, alice2, USERNAME.ALICE);
  // Verify that the Session logo is shown on the landing page
  await verifyElementScreenshot(
    alice2,
    new EmptyLandingPageScreenshot(alice2),
    testInfo,
    'restore_account'
  );
  await closeApp(alice1, alice2);
}
