import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { OpenURLDialogConfirmButton } from '../../locators/global';
import { DonationsMenuItem, UserSettings } from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import { getBrowserUrlField } from '../../utils/handle_first_open';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { checkOpenUrlDialogStrings } from '../../utils/open_url_dialog';
import { assertUrlIsReachable, ensureHttpsURL, verify } from '../../utils/utilities';

bothPlatformsIt({
  title: 'Donate Settings menu item',
  risk: 'high',
  testCb: donateLinkout,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Donations',
  },
  allureDescription:
    'Verifies that the Settings donation link is correct and that the HTTP request is successful (200)',
});

async function donateLinkout(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const linkURL = 'https://getsession.org/donate';
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new DonationsMenuItem(device));
  await checkOpenUrlDialogStrings(device, linkURL);
  await device.clickOnElementAll(new OpenURLDialogConfirmButton(device));
  const urlField = await getBrowserUrlField(device);
  const actualUrlField = await device.getTextFromElement(urlField);
  const fullRetrievedURL = ensureHttpsURL(actualUrlField);
  // Verify that it's the correct URL
  verify(fullRetrievedURL, 'The retrieved URL does not match the expected').toBe(linkURL);
  await assertUrlIsReachable(linkURL);
  // Close browser and app
  await device.backToSession();
  await closeApp(device);
}
