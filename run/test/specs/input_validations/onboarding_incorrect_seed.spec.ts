import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  AccountRestoreButton,
  SeedPhraseInput,
  ContinueButton,
  ErrorMessage,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { localize } from '../../../localizer/i18n/localizedString';

bothPlatformsIt('Onboarding incorrect seed', 'low', onboardingIncorrectSeed);

// the word 'zork' is not on the mnemonic word list which triggers the expected error
const incorrectSeed =
  'ruby bakery illness push rift reef nabbing bawled hope zork silk lobster hope';
// the expected error is 'Some words are incorrect' which is represented by the following localized string
const expectedError = localize('recoveryPasswordErrorMessageIncorrect').strip().toString();

async function onboardingIncorrectSeed(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(incorrectSeed, new SeedPhraseInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error message on Android
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
