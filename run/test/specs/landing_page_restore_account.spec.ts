import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { linkedDevice } from './utils/link_device';
import { USERNAME } from '../../types/testing';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';

bothPlatformsIt({
  title: 'Landing page restore account',
  risk: 'low',
  testCb: landingPageRestoreAccount,
  countOfDevicesNeeded: 2,
});

async function landingPageRestoreAccount(platform: SupportedPlatformsType) {
  // Creating a linked device is used as a shortcut to restore an account
  const { device1, device2 } = await openAppTwoDevices(platform);
  await linkedDevice(device1, device2, USERNAME.ALICE);
  // Verify that the Session logo is shown on the landing page
  await verifyElementScreenshot(
    device2,
    new EmptyLandingPageScreenshot(device2),
    'restore_account'
  );
  await closeApp(device1, device2);
}
