import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';
import { open2AppsLinkedUser } from './state_builder';

bothPlatformsIt({
  title: 'Landing page restore account',
  risk: 'low',
  testCb: landingPageRestoreAccount,
  countOfDevicesNeeded: 2,
});

async function landingPageRestoreAccount(platform: SupportedPlatformsType) {
  // Creating a linked device is used as a shortcut to restore an account
  const {
    devices: { device1, device2 },
  } = await open2AppsLinkedUser({ platform });
  // Verify that the Session logo is shown on the landing page
  await verifyElementScreenshot(
    device2,
    new EmptyLandingPageScreenshot(device2),
    'restore_account'
  );
  await closeApp(device1, device2);
}
