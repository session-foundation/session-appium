import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { SafariAddressBar, URLInputField } from '../locators/browsers';
import { OpenLinkButton } from '../locators/network_page';
import { DonationsMenuItem, UserSettings } from '../locators/settings';
import { newUser } from '../utils/create_account';
import { handleChromeFirstTimeOpen } from '../utils/handle_first_open';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { assertUrlIsReachable, ensureHttpsURL } from '../utils/utilities';

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
  const linkURL = 'https://getsession.org/donate#app';
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new DonationsMenuItem(device));
  await device.checkModalStrings(
    tStripped('urlOpen'),
    tStripped('urlOpenDescription', { url: linkURL })
  );
  await device.clickOnElementAll(new OpenLinkButton(device));
  if (platform === 'ios') {
    // Tap the Safari address bar to reveal the URL
    await device.clickOnElementAll(new SafariAddressBar(device));
  } else {
    // Chrome can throw some modals on first open
    await handleChromeFirstTimeOpen(device);
  }
  const urlField = await device.waitForTextElementToBePresent(new URLInputField(device));
  const actualUrlField = await device.getTextFromElement(urlField);
  const fullRetrievedURL = ensureHttpsURL(actualUrlField);
  // Verify that it's the correct URL
  if (fullRetrievedURL !== linkURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  }
  await assertUrlIsReachable(linkURL);
  // Close browser and app
  await device.backToSession();
  await closeApp(device);
}
