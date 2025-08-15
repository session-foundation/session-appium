import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
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

bothPlatformsItSeparate({
  title: 'App disguise set icon',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  android: {
    testCb: appDisguiseSetIconAndroid,
  },
  ios: {
    testCb: appDisguiseSetIconIOS,
  },
  allureSuites: {
    parent: 'Settings',
    suite: 'App Disguise',
  },
  allureDescription: 'Verifies the alternate icon set on the App Disguise page is applied',
});

async function appDisguiseSetIconIOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new AppearanceMenuItem(device));
  await sleepFor(2000);
  await device.scrollDown();
  await device.clickOnElementAll(new SelectAppIcon(device));
  try {
    await device.clickOnElementAll(new AppDisguiseMeetingIcon(device));
    await device.waitForTextElementToBePresent({
      strategy: 'accessibility id', 
      selector: 'You have changed the icon for “Session”.'
    });
    await device.clickOnElementAll({
      strategy: 'accessibility id', 
      selector: 'OK'
    });
    // TODO maybe grab a screenshot of the disguised app and see what you can do with it 
  } finally {
    // The disguised app must be uninstalled otherwise every following test will fail
    await closeApp(device);
    await runScriptAndLog(`xcrun simctl uninstall ${device.udid} com.loki-project.loki-messenger`, true);
  }
}

async function appDisguiseSetIconAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new AppearanceMenuItem(device));
  await sleepFor(2000);
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
      `${getAdbFullPath()} -s ${device.udid} uninstall network.loki.messenger.qa`,
      true
    );
  }
}
