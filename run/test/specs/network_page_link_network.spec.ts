import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import {
  OpenLinkButton,
  SessionNetworkLearnMoreNetwork,
  SessionNetworkMenuItem,
} from './locators/network_page';
import { UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { handleChromeFirstTimeOpen } from './utils/handle_first_open';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable, ensureHttpsURL } from './utils/utilities';

bothPlatformsIt({
  title: 'Network page learn more network link',
  risk: 'medium',
  testCb: networkPageLearnMore,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Network Page',
  },
  allureDescription:
    'Verifies that the "Learn More" link on the Network Page opens the correct URL in the device browser.',
});

async function networkPageLearnMore(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const linkURL = 'https://docs.getsession.org/session-network';
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.onAndroid().scrollDown();
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  await device.clickOnElementAll(new SessionNetworkLearnMoreNetwork(device));
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
