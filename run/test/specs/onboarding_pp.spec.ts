import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { SafariAddressBar, URLInputField } from './locators/browsers';
import { PrivacyPolicyButton, SplashScreenLinks } from './locators/onboarding';
import { handleChromeFirstTimeOpen } from './utils/handle_first_open';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { assertUrlIsReachable, ensureHttpsURL } from './utils/utilities';

bothPlatformsIt({
  title: 'Onboarding privacy policy',
  risk: 'high',
  testCb: onboardingPP,
  countOfDevicesNeeded: 1,
});

async function onboardingPP(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
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
    await handleChromeFirstTimeOpen(device);
  }
  // Retrieve URL
  const urlField = await device.waitForTextElementToBePresent(new URLInputField(device));
  const retrievedURL = await device.getTextFromElement(urlField);
  const fullRetrievedURL = ensureHttpsURL(retrievedURL);
  // Verify that it's the correct URL
  if (fullRetrievedURL !== ppURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  }
  await assertUrlIsReachable(ppURL);
  // Close browser and app
  await device.backToSession();
  await closeApp(device);
}
