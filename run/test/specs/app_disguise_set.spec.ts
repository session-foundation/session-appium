import { androidIt } from '../../types/sessionIt';
import { SupportedPlatformsType, openAppOnPlatformSingleDevice } from './utils/open_app';
import { newUser } from './utils/create_account';
import { USERNAME } from '../../types/testing';
import {
  AppDisguiseMeetingIcon,
  AppearanceMenuItem,
  CloseAppButton,
  SelectAppIcon,
  UserSettings,
} from './locators/settings';
import { DisguisedApp } from './locators/external';
import { sleepFor } from './utils';
import { runScriptAndLog } from './utils/utilities';
import { getAdbFullPath } from './utils/binaries';

// iOS implementation blocked by SES-3809
androidIt({
  title: 'App disguise set icon',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: appDisguiseSetIcon,
});

async function appDisguiseSetIcon(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  try {
    await newUser(device, USERNAME.ALICE);
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new AppearanceMenuItem(device));
    await sleepFor(2000);
    // Must scroll down to reveal the app disguise option
    await device.scrollDown();
    await device.clickOnElementAll(new SelectAppIcon(device));
    await device.clickOnElementAll(new AppDisguiseMeetingIcon(device));
    // TODO check modal strings once locales.ts has been updated
    await device.clickOnElementAll(new CloseAppButton(device));
    await sleepFor(2000);
    // Open app library and check for disguised app
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} shell input swipe 500 1700 500 500`
    );
    await device.waitForTextElementToBePresent(new DisguisedApp(device));
  } finally {
    // The disguised app must be uninstalled otherwise every following test will fail
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} uninstall network.loki.messenger`,
      true
    );
  }
}
