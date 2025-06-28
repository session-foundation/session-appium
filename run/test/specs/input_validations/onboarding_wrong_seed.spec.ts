import { englishStrippedStr } from '../../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  AccountRestoreButton,
  ContinueButton,
  ErrorMessage,
  SeedPhraseInput,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Onboarding wrong seed',
  risk: 'low',
  testCb: onboardingIncorrectSeed,
  countOfDevicesNeeded: 1,
});

async function onboardingIncorrectSeed(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  // the seed phrase is too long but contains only valid mnemonics which triggers the generic error
  const wrongSeed =
    'ruby bakery illness push rift reef nabbing bawled hope ruby silk lobster hope ruby ruby ruby';
  // the expected error is 'Please check your recovery password' which is represented by the following localized string
  const expectedError = englishStrippedStr('recoveryPasswordErrorMessageGeneric').toString();
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(wrongSeed, new SeedPhraseInput(device));
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
