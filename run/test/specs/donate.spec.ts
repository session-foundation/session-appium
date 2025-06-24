import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import { DonationsMenuItem, UserSettings } from './locators/settings';
import { handleChromeFirstTimeOpen } from './utils/handle_first_open';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable, ensureHttpsURL } from './utils/utilities';
import { OpenLinkButton } from './locators/network_page';

bothPlatformsIt({
  title: 'Donate linkout',
  risk: 'high',
  testCb: donateLinkout,
  countOfDevicesNeeded: 1,
});

// TODO add in screenshot verification

async function donateLinkout(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const linkURL = 'https://session.foundation/donate#app';
  await newUser(device, USERNAME.ALICE);
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new DonationsMenuItem(device));
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
