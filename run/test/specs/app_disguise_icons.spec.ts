import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp, openAppOnPlatformSingleDevice } from './utils/open_app';
import { newUser } from './utils/create_account';
import { USERNAME } from '../../types/testing';
import { AppearanceMenuItem, SelectAppIcon, UserSettings } from './locators/settings';
import { verifyElementScreenshot } from './utils/verify_screenshots';
import { AppDisguisePageScreenshot } from './utils/screenshot_paths';
import { sleepFor } from './utils';

bothPlatformsIt({
  title: 'App disguise icons',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: appDisguiseIcons,
});

async function appDisguiseIcons(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new UserSettings(device));
  // Must scroll down to reveal the Appearance menu item
  await device.scrollDown();
  await device.clickOnElementAll(new AppearanceMenuItem(device));
  await sleepFor(2000);
  // Must scroll down to reveal the app disguise option
  await device.scrollDown();
  await device.clickOnElementAll(new SelectAppIcon(device));
  await verifyElementScreenshot(device, new AppDisguisePageScreenshot(device));
  await closeApp(device);
}
