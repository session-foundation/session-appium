import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  CreateAccountButton,
  DisplayNameInput,
  ContinueButton,
  ErrorMessage,
} from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { localize } from '../../../localizer/i18n/localizedString';

bothPlatformsIt('Onboarding no name', 'low', onboardingNoName);

const emptyName = '';
// the expected error is 'Please enter a display name' which is represented by the following localized string
const expectedError = localize('displayNameErrorDescription').strip().toString();

async function onboardingNoName(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new CreateAccountButton(device));
  // this check is to avoid false positives
  if (emptyName.length > 0) {
    throw new Error('The emptyName string is not empty but it must be.');
  }
  await device.inputText(emptyName, new DisplayNameInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error text
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device).build());
  const errorMessage = await device.getTextFromElement(error);
  console.log(`The error message is "${errorMessage}"`);
  console.log(`The expected error is "${expectedError}"`);
  // Compare the fetched text with the expected 'Please enter a display name' string
  if (errorMessage === expectedError) {
    console.log('The observed error message matches the expected');
  } else {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
