import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';
import { open_Alice2 } from './state_builder';

bothPlatformsIt({
  title: 'Landing page restore account',
  risk: 'low',
  testCb: landingPageRestoreAccount,
  countOfDevicesNeeded: 2,
});

async function landingPageRestoreAccount(platform: SupportedPlatformsType) {
  // Creating a linked device is used as a shortcut to restore an account
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform });
  // Verify that the Session logo is shown on the landing page
  await verifyElementScreenshot(
    alice2,
    new EmptyLandingPageScreenshot(alice2),
    'restore_account'
  );
  await closeApp(alice1, alice2);
}
