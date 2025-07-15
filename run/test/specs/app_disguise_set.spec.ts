import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DisguisedApp } from './locators/external';
import {
  AppDisguiseMeetingIcon,
  AppearanceMenuItem,
  CloseAppButton,
  SelectAppIcon,
  UserSettings,
} from './locators/settings';
import { sleepFor } from './utils';
import { getAdbFullPath } from './utils/binaries';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { closeApp } from './utils/open_app';
import { runScriptAndLog } from './utils/utilities';

// iOS implementation blocked by SES-3809
androidIt({
  title: 'App disguise set icon',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: appDisguiseSetIcon,
  allureSuites: {
    parent: 'Settings',
    suite: 'App Disguise',
  },
  allureDescription: 'Verifies the alternate icon set on the App Disguise page is applied',
});

async function appDisguiseSetIcon(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, false);
  await device.clickOnElementAll(new UserSettings(device));
  // Must scroll down to reveal the Appearance menu item
  await device.scrollDown();
  await device.clickOnElementAll(new AppearanceMenuItem(device));
  await sleepFor(2000);
  // Must scroll down to reveal the app disguise option
  await device.scrollDown();
  await device.clickOnElementAll(new SelectAppIcon(device));
  try {
    await device.clickOnElementAll(new AppDisguiseMeetingIcon(device));
    await device.checkModalStrings(
      englishStrippedStr('appIconAndNameChange').toString(),
      englishStrippedStr('appIconAndNameChangeConfirmation').toString()
    );
    await device.clickOnElementAll(new CloseAppButton(device));
    await sleepFor(2000);
    // Open app library and check for disguised app
    await device.swipeFromBottom();
    await device.waitForTextElementToBePresent(new DisguisedApp(device));
  } finally {
    // The disguised app must be uninstalled otherwise every following test will fail
    await closeApp(device);
    await runScriptAndLog(
      `${getAdbFullPath()} -s ${device.udid} uninstall network.loki.messenger`,
      true
    );
  }
}
