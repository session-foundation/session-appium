import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';
import { linkedDevice } from './utils/link_device';
import { USERNAME } from '../../types/testing';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmptyLandingPage } from './locators/home';

bothPlatformsIt('Landing page restore account', 'low', landingPageRestoreAccount);

async function landingPageRestoreAccount(platform: SupportedPlatformsType) {
  // Creating a linked device is used as a shortcut to restore an account
  const { device1, device2 } = await openAppTwoDevices(platform);
  await linkedDevice(device1, device2, USERNAME.ALICE);
  // Verify that the Session logo is shown on the landing page
  await verifyElementScreenshot(
    device2,
    new EmptyLandingPage(device2),
    `run/screenshots/${platform}/landingpage_restore_account.png`
  );
  await closeApp(device1, device2);
}
