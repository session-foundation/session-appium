import { bothPlatformsIt } from '../../types/sessionIt';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { USERNAME } from '../../types/testing';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmptyLandingPageScreenshot } from './utils/screenshot_paths';

bothPlatformsIt({
  title: 'Landing page new account',
  risk: 'low',
  testCb: landingPageNewAccount,
  countOfDevicesNeeded: 1,
});

async function landingPageNewAccount(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  // Verify that the party popper is shown on the landing page
  await verifyElementScreenshot(device, new EmptyLandingPageScreenshot(device), 'new_account');
  await closeApp(device);
}
