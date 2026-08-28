import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../../types/sessionIt';
import { SplashScreenLinks, TermsOfServiceButton } from '../../locators/onboarding';
import { getBrowserUrlField } from '../../utils/handle_first_open';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { assertUrlIsReachable, ensureHttpsURL } from '../../utils/utilities';

bothPlatformsIt({
  title: 'Onboarding terms of service',
  risk: 'high',
  testCb: onboardingTOS,
  countOfDevicesNeeded: 1,
});
async function onboardingTOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const tosURL = 'https://getsession.org/terms-of-service';
  // Tap the text at the bottom of the splash screen to bring up the TOS/PP links modal
  await device.clickOnElementAll(new SplashScreenLinks(device));
  // Tap Privacy Policy
  await device.clickOnElementAll(new TermsOfServiceButton(device));
  const urlField = await getBrowserUrlField(device);
  const retrievedURL = await device.getTextFromElement(urlField);
  const fullRetrievedURL = ensureHttpsURL(retrievedURL);
  // Verify that it's the correct URL
  if (fullRetrievedURL !== tosURL) {
    throw new Error(
      `The retrieved URL does not match the expected. The retrieved URL is ${fullRetrievedURL}`
    );
  }
  await assertUrlIsReachable(tosURL);
  // Close browser and app
  await device.backToSession();
  await closeApp(device);
}
