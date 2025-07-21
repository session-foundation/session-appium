import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { LastUpdatedTimeStamp, SessionNetworkMenuItem } from './locators/network_page';
import { UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Refresh network page',
  risk: 'low',
  testCb: refreshNetworkPage,
  countOfDevicesNeeded: 1,
});

async function refreshNetworkPage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);

  const lastUpdatedExpected = 'Last updated 0m ago';
  await newUser(device, USERNAME.ALICE, false);
  await device.clickOnElementAll(new UserSettings(device));
  await device.onAndroid().scrollDown();
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  //   Check for loading states
  await device.waitForLoadingMedia();
  await device.pullToRefresh();
  await device.waitForLoadingMedia();
  await device.onAndroid().scrollDown();
  const timeStampEl = await device.waitForTextElementToBePresent(new LastUpdatedTimeStamp(device));
  const lastUpdatedActual = await device.getTextFromElement(timeStampEl);
  if (lastUpdatedActual !== lastUpdatedExpected) {
    throw new Error(
      `The retrieved last updated time does not match the expected. The retrieved last updated time is ${lastUpdatedActual}`
    );
  }
}
