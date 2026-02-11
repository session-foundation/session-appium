import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ContinueButton } from '../locators/global';
import { CreateAccountButton, DisplayNameInput, ErrorMessage } from '../locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Onboarding no name',
  risk: 'low',
  testCb: onboardingNoName,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Onboarding',
    suite: 'Input validations',
  },
  allureDescription: `Verifies that an empty display name throws the 'please enter a display name' error as expected.`,
});

async function onboardingNoName(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await device.clickOnElementAll(new CreateAccountButton(device));
  // the expected error is 'Please enter a display name' which is represented by the following localized string
  const expectedError = tStripped('displayNameErrorDescription');
  const emptyName = '';
  // this check is to avoid false positives
  if (emptyName.length > 0) {
    throw new Error('The emptyName string is not empty but it must be.');
  }
  await device.inputText(emptyName, new DisplayNameInput(device));
  // Trigger the validation by pressing Continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for, and fetch the error text
  const error = await device.waitForTextElementToBePresent(new ErrorMessage(device));
  const errorMessage = await device.getTextFromElement(error);
  // Compare the fetched text with the expected 'Please enter a display name' string
  if (errorMessage !== expectedError) {
    throw new Error('The observed error message does not match the expected');
  }
  await closeApp(device);
}
