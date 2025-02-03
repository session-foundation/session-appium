import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  CreateAccountButton,
  DisplayNameInput,
  ContinueButton,
  ErrorMessage,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { localize } from '../../../localizer/i18n/localizedString';

bothPlatformsIt('Onboarding long name', 'low', onboardingLongName);

// the libSession limit for display names is 100 bytes - this string is 101 chars (i.e. 101 bytes)
const tooLongName =
  'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed int';
// the expected error is 'Please enter a shorter display name' which is represented by the following localized string
const expectedError = localize('displayNameErrorDescriptionShorter').strip().toString();

async function onboardingLongName(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new CreateAccountButton(device));
  // this check is to avoid false positives
  if (tooLongName.length <= 100) {
    throw new Error(
      `The string to test the display name length check is too short. It is only: 
        ${tooLongName.length},
        characters long but needs to be >100. `
    );
  }
  await device.inputText(tooLongName, new DisplayNameInput(device));
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
