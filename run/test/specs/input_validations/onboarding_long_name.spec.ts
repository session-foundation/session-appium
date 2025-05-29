import { englishStrippedStr } from '../../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CreateAccountButton, DisplayNameInput, ErrorMessage } from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { ContinueButton } from '../locators/global';

bothPlatformsIt({
  title: 'Onboarding long name',
  risk: 'low',
  testCb: onboardingLongName,
  countOfDevicesNeeded: 1,
});

async function onboardingLongName(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  // the libSession limit for display names is 100 bytes - this string is 101 chars (i.e. 101 bytes)
  const tooLongName =
    'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed int';
  // the expected error is 'Please enter a shorter display name' which is represented by the following localized string
  const expectedError = englishStrippedStr('displayNameErrorDescriptionShorter').toString();
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
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device));
  const errorMessage = await device.getTextFromElement(error);
  // Compare the fetched string with the expected string
  if (errorMessage !== expectedError) {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
