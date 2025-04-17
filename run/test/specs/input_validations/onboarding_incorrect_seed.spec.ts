import { englishStripped } from '../../../localizer/Localizer';
import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  AccountRestoreButton,
  ContinueButton,
  ErrorMessage,
  SeedPhraseInput,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt('Onboarding incorrect seed', 'low', onboardingIncorrectSeed);

async function onboardingIncorrectSeed(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new AccountRestoreButton(device));
  // the word 'zork' is not on the mnemonic word list which triggers the expected error
  const incorrectSeed =
    'ruby bakery illness push rift reef nabbing bawled hope zork silk lobster hope';
  // the expected error is 'Some words are incorrect' which is represented by the following localized string
  const expectedError = englishStripped('recoveryPasswordErrorMessageIncorrect').toString();
  await device.inputText(incorrectSeed, new SeedPhraseInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error message on Android
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device));
  const errorMessage = await device.getTextFromElement(error);
  // Compare the fetched string with the expected string
  if (errorMessage !== expectedError) {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
