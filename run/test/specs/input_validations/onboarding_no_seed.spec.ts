import { englishStripped } from '../../../localizer/Localizer';
import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  AccountRestoreButton,
  ContinueButton,
  ErrorMessage,
  SeedPhraseInput,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt('Onboarding no seed', 'low', onboardingNoSeed);

async function onboardingNoSeed(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new AccountRestoreButton(device));
  const emptySeed = '';
  // the expected error is 'Recovery Password not long enough' which is represented by the following localized string
  const expectedError = englishStripped('recoveryPasswordErrorMessageShort').toString();
  // this check is to avoid false positives
  if (emptySeed.length > 0) {
    throw new Error('The emptySeed string is not empty but it must be.');
  }
  await device.inputText(emptySeed, new SeedPhraseInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error message
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device));
  const errorMessage = await device.getTextFromElement(error);
  // Compare the fetched string with the expected string
  if (errorMessage !== expectedError) {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
