import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { LastUpdatedTimeStamp, SessionNetworkMenuItem } from './locators/network_page';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Network page refresh',
  risk: 'low',
  testCb: refreshNetworkPage,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Network Page',
  },
  allureDescription: `Verifies that the Network Page refreshes and updates the "Last updated" timestamp correctly.`,
  allureLinks: {
    android: 'SES-4884',
  },
});

async function refreshNetworkPage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const zeroMinutesAgo = '0m';
  const oneMinuteAgo = '1m';

  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.onAndroid().scrollDown();
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  await device.waitForLoadingMedia(); // Wait for fetch to complete
  await device.waitForTextElementToBePresent(new LastUpdatedTimeStamp(device, zeroMinutesAgo));
  await sleepFor(65_000); // 60+5 seconds to ensure the last updated value changes
  await device.waitForTextElementToBePresent(new LastUpdatedTimeStamp(device, oneMinuteAgo));
  await device.pullToRefresh();
  await device.waitForLoadingMedia();
  await device.waitForTextElementToBePresent(new LastUpdatedTimeStamp(device, zeroMinutesAgo));
  await closeApp(device);
}
