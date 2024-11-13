import { bothPlatformsIt } from '../../types/sessionIt';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import { PrivacyPolicyButton, SplashScreenLinks } from './locators/onboarding';
import { runOnlyOnAndroid, runOnlyOnIOS } from './utils';
import { isChromeFirstTimeOpen } from './utils/chrome_first_time_open';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Onboarding privacy policy', 'high', onboardingPP);

async function onboardingPP(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  const ppURL = 'https://getsession.org/privacy-policy';
  // Tap the text at the bottom of the splash screen to bring up the TOS/PP links modal
  await device.clickOnElementAll(new SplashScreenLinks(device));
  // Tap Privacy Policy
  await device.clickOnElementAll(new PrivacyPolicyButton(device));
  // Identifying the URL field works differently in Safari and Chrome
  if (platform === 'ios') {
    // Tap the Safari address bar to reveal the URL
    await device.clickOnElementAll(new SafariAddressBar(device));
  } else {
    // Chrome can throw some modals on first open
    await isChromeFirstTimeOpen(device);
  }
  // Retrieve URL
  const urlField = await device.waitForTextElementToBePresent(new URLInputField(device));
  const retrievedURL = await device.getTextFromElement(urlField);
  // Add https:// to the retrieved URL if the UI doesn't show it (Chrome doesn't, Safari does)
  const fullRetrievedURL = retrievedURL.startsWith('https://')
    ? retrievedURL
    : `https://${retrievedURL}`;
  // Verify that it's the correct URL
  if (fullRetrievedURL !== ppURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  } else {
    console.log('The URLs match.');
  }
  // Close browser and app
  await runOnlyOnIOS(platform, () => device.clickOnCoordinates(42, 42)); // I don't like this but nothing else works
  await runOnlyOnAndroid(platform, () => device.back());
  await closeApp(device);
}
