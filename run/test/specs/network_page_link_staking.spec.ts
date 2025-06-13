import { verifyPageScreenshot } from './utils/verify_screenshots';
import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import {
  OpenLinkButton,
  SessionNetworkLearnMoreStaking,
  SessionNetworkMenuItem,
} from './locators/network_page';
import { UserSettings } from './locators/settings';
import { isChromeFirstTimeOpen } from './utils/chrome_first_time_open';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { ensureHttpsURL } from './utils/utilities';

bothPlatformsIt({
  title: 'Network page learn more staking link',
  risk: 'medium',
  testCb: networkPageLearnMore,
  countOfDevicesNeeded: 1,
});

async function networkPageLearnMore(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const linkURL = 'https://docs.getsession.org/session-network/staking';
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new UserSettings(device));
  await device.onAndroid().scrollDown();
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  await device.clickOnElementAll(new SessionNetworkLearnMoreStaking(device));
  await device.checkModalStrings(
    englishStrippedStr('urlOpen').toString(),
    englishStrippedStr('urlOpenDescription').withArgs({ url: linkURL }).toString()
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
  const retrievedURL = await device.getTextFromElement(urlField);
  // Add https:// to the retrieved URL if the UI doesn't show it (Chrome doesn't, Safari does)
  const fullRetrievedURL = ensureHttpsURL(retrievedURL);
  // Verify that it's the correct URL
  if (fullRetrievedURL !== linkURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  } else {
    console.log('The URLs match.');
  }
  await verifyPageScreenshot(platform, device, 'staking_page');
  // Close browser and app
  await device.backToSession();
  await closeApp(device);
}
