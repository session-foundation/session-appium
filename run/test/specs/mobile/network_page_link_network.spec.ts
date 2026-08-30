import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { OpenURLDialogConfirmButton } from '../../locators/global';
import {
  SessionNetworkLearnMoreNetwork,
  SessionNetworkMenuItem,
} from '../../locators/network_page';
import { UserSettings } from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import { getBrowserUrlField } from '../../utils/handle_first_open';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { checkOpenUrlDialogStrings } from '../../utils/open_url_dialog';
import { assertUrlIsReachable, ensureHttpsURL } from '../../utils/utilities';

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
  await checkOpenUrlDialogStrings(device, linkURL);
  await device.clickOnElementAll(new OpenURLDialogConfirmButton(device));
  const urlField = await getBrowserUrlField(device);
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
