import type { UserNameType } from '@session-foundation/qa-seeder';

import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ContinueButton } from '../locators/global';
import { PlusButton } from '../locators/home';
import {
  AccountRestoreButton,
  DisplayNameInput,
  FastModeRadio,
  SeedPhraseInput,
} from '../locators/onboarding';
import { newUser } from './create_account';
import { BaseSetupOptions } from './create_account';
import { handlePermissions } from './permissions';

export const linkedDevice = async (
  device1: DeviceWrapper,
  device2: DeviceWrapper,
  userName: UserNameType,
  options?: BaseSetupOptions
) => {
  const { allowNotificationPermissions = false } = options || {};
  const user = await newUser(device1, userName);
  // Log in with recovery seed on device 2
  device2.setDeviceIdentity(`${userName.toLowerCase()}2`);

  await device2.clickOnElementAll(new AccountRestoreButton(device2));
  // Enter recovery phrase into input box
  await device2.inputText(user.recoveryPhrase, new SeedPhraseInput(device2));
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device2.clickOnElementAll(new ContinueButton(device2));
  // Wait for any notifications to disappear
  await device2.clickOnElementAll(new FastModeRadio(device2));
  // Click continue on message notification settings
  await device2.clickOnElementAll(new ContinueButton(device2));
  // Wait for loading animation to look for display name
  await device2.waitForLoadingOnboarding();
  const displayName = await device2.doesElementExist({
    ...new DisplayNameInput(device2).build(),
    maxWait: 500,
  });
  if (displayName) {
    await device2.inputText(userName, new DisplayNameInput(device2));
    await device2.clickOnElementAll(new ContinueButton(device2));
  } else {
    device2.info('Display name found: Loading account');
  }
  // Wait for permissions modal to pop up
  await handlePermissions(device2, allowNotificationPermissions);
  // Check that button was clicked
  await device2.waitForTextElementToBePresent(new PlusButton(device2));

  device2.info('Device linked');

  return user;
};
