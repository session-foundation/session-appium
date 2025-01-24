import { bothPlatformsIt } from '../../types/sessionIt';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { USERNAME } from '../../types/testing';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { EmpytLandingPage } from './locators/home';

bothPlatformsIt('Landing page new account', 'low', landingPageNewAccount);

async function landingPageNewAccount(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  // Verify that the party popper is shown on the landing page
  await verifyElementScreenshot(
    device,
    new EmpytLandingPage(device),
    `run/screenshots/${platform}/landingpage_new_account.png`
  );
  await closeApp(device);
}
