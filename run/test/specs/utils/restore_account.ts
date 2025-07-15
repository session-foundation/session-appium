import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { ContinueButton } from '../../specs/locators/global';
import { PlusButton } from '../locators/home';
import {
  AccountRestoreButton,
  DisplayNameInput,
  SeedPhraseInput,
  SlowModeRadio,
} from '../locators/onboarding';

export const restoreAccount = async (device: DeviceWrapper, user: User) => {
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(user.recoveryPhrase, new SeedPhraseInput(device));
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for any notifications to disappear
  await device.clickOnElementAll(new SlowModeRadio(device));
  // Click continue on message notification settings
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for loading animation to look for display name
  await device.waitForLoadingOnboarding();
  const displayName = await device.doesElementExist({
    ...new DisplayNameInput(device).build(),
    maxWait: 2000,
  });
  if (displayName) {
    await device.inputText(user.userName, new DisplayNameInput(device));
    await device.clickOnElementAll(new ContinueButton(device));
  } else {
    device.info('Display name found: Loading account');
  }
  // Wait for permissions modal to pop up
  await sleepFor(500);
  await device.checkPermissions('Allow');
  await sleepFor(1000);
  // Check that we're on the home screen
  await device.waitForTextElementToBePresent(new PlusButton(device));
};

/**
 * Restore the account linked to seed.
 * If the account isn't found on the network, fail the test.
 */
export const restoreAccountNoFallback = async (device: DeviceWrapper, recoveryPhrase: string) => {
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(recoveryPhrase, new SeedPhraseInput(device));
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for any notifications to disappear
  await device.clickOnElementAll(new SlowModeRadio(device));
  // Click continue on message notification settings
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for loading animation to look for display name
  await device.waitForLoadingOnboarding();
  const displayName = await device.doesElementExist({
    ...new DisplayNameInput(device).build(),
    maxWait: 2000,
  });
  if (displayName) {
    throw new Error('Account not found');
  }
  device.info('Display name found: Loading account');

  // Wait for permissions modal to pop up
  await sleepFor(500);
  await device.checkPermissions('Allow');
  await sleepFor(1000);
  // Check that we're on the home screen
  await device.waitForTextElementToBePresent(new PlusButton(device));
};
