import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import {
  OpenLinkButton,
  SessionNetworkLearnMoreNetwork,
  SessionNetworkMenuItem,
} from './locators/network_page';
import { UserSettings } from './locators/settings';
import { isChromeFirstTimeOpen } from './utils/chrome_first_time_open';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Network page learn more network link',
  risk: 'medium',
  testCb: networkPageLearnMore,
  countOfDevicesNeeded: 1,
});

async function networkPageLearnMore(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const linkURL = 'https://getsession.org/session-network';
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new UserSettings(device));
  await device.onAndroid().scrollDown();
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  await device.clickOnElementAll(new SessionNetworkLearnMoreNetwork(device));
  await device.checkModalStrings(
    englishStripped('urlOpen').toString(),
    englishStripped('urlOpenDescription').withArgs({ url: linkURL }).toString()
  );
  await device.clickOnElementAll(new OpenLinkButton(device));
  if (platform === 'ios') {
    // Tap the Safari address bar to reveal the URL
    await device.clickOnElementAll(new SafariAddressBar(device));
  } else {
    // Chrome can throw some modals on first open
    await isChromeFirstTimeOpen(device);
  }
  const urlField = await device.waitForTextElementToBePresent(new URLInputField(device));
  const actualUrlField = await device.getTextFromElement(urlField);
  // Add https:// to the retrieved URL if the UI doesn't show it (Chrome doesn't, Safari does)
  const fullRetrievedURL = actualUrlField.startsWith('https://')
    ? actualUrlField
    : `https://${actualUrlField}`;
  // Verify that it's the correct URL
  if (fullRetrievedURL !== linkURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  } else {
    console.log('The URLs match.');
  }
  // TODO need to verify that the page loaded correctly (need to wait for page to be made)
  // Close browser and app
  await device.onIOS().clickOnCoordinates(42, 42);
  await device.onAndroid().back();
  await closeApp(device);
}
