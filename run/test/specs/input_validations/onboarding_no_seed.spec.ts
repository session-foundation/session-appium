import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  AccountRestoreButton,
  SeedPhraseInput,
  ContinueButton,
  ErrorMessage,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { localize } from '../../../localizer/i18n/localizedString';

bothPlatformsIt('Onboarding no seed', 'low', onboardingNoSeed);

const emptySeed = '';
// the expected error is 'Recovery Password not long enough' which is represented by the following localized string
const expectedError = localize('recoveryPasswordErrorMessageShort').strip().toString();

async function onboardingNoSeed(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new AccountRestoreButton(device));
  // this check is to avoid false positives
  if (emptySeed.length > 0) {
    throw new Error('The emptySeed string is not empty but it must be.');
  }
  await device.inputText(emptySeed, new SeedPhraseInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error message
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device).build());
  const errorMessage = await device.getTextFromElement(error);
  console.log(`The error message is "${errorMessage}"`);
  console.log(`The expected error is "${expectedError}"`);
  // Compare the fetched string with the expected string
  if (errorMessage === expectedError) {
    console.log('The observed error message matches the expected');
  } else {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
