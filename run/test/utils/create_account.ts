import type { UserNameType } from '@session-foundation/qa-seeder';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { User } from '../../types/testing';
import { CloseSettings } from '../locators';
import { AccountIDDisplay, ContinueButton } from '../locators/global';
import {
  CreateAccountButton,
  DisplayNameInput,
  FastModeRadio,
  SlowModeRadio,
} from '../locators/onboarding';
import { RecoveryPasswordMenuItem, RecoveryPhraseContainer } from '../locators/settings';
import { UserSettings } from '../locators/settings';
import { handleBackgroundPermissions, handleNotificationPermissions } from './permissions';

export type BaseSetupOptions = {
  allowNotificationPermissions?: boolean;
};

/**
 * Setup options for account creation specifically
 *
 * By default, new accounts will:
 * - set fast mode
 * - deny notification permissions
 *
 * If fast mode is `false` and allowBackgroundPermissions is not explicitly set,
 * the test will have to handle the background permissions modal on Android.
 * Tests that *do* grant background permissions must clean up with a try/finally uninstall
 * to avoid state pollution in following tests.
 *
 * Note that this is all theoretically possible in restore account as well, we just don't bother to do it.
 */
export type NewUserSetupOptions = BaseSetupOptions & {
  saveUserData?: boolean;
  fastMode?: boolean;
  allowBackgroundPermissions?: boolean;
};

export async function newUser(
  device: DeviceWrapper,
  userName: UserNameType,
  options?: NewUserSetupOptions
): Promise<User> {
  const {
    saveUserData = true,
    allowNotificationPermissions = false,
    allowBackgroundPermissions,
    fastMode = true,
  } = options || {};
  device.setDeviceIdentity(`${userName.toLowerCase()}1`);
  await device.clickOnElementAll(new CreateAccountButton(device));
  await device.inputText(userName, new DisplayNameInput(device));
  await device.clickOnElementAll(new ContinueButton(device));
  // Choose message notification options (Fast mode by default)
  if (fastMode) {
    await device.clickOnElementAll(new FastModeRadio(device));
  } else await device.clickOnElementAll(new SlowModeRadio(device));
  await device.clickOnElementAll(new ContinueButton(device));
  // Handle permissions based on the flag
  await handleNotificationPermissions(device, allowNotificationPermissions);
  if (!fastMode) {
    await handleBackgroundPermissions(device, allowBackgroundPermissions);
  }
  // Some tests don't need to save the Account ID and Recovery Password
  if (!saveUserData) {
    return { userName, accountID: 'not_needed', recoveryPhrase: 'not_needed' };
  }

  // Open recovery phrase modal and save recovery phrase
  await device.clickOnElementAll(new UserSettings(device));
  await device.onIOS().scrollDown();
  await device.clickOnElementAll(new RecoveryPasswordMenuItem(device));
  const recoveryPhraseContainer = await device.clickOnElementAll(
    new RecoveryPhraseContainer(device)
  );
  const recoveryPhrase = await device.getTextFromElement(recoveryPhraseContainer);
  device.log(`${userName}s recovery phrase is "${recoveryPhrase}"`);
  await device.navigateBack(false);
  await device.scrollUp();
  // Get Account ID from User Settings
  const el = await device.waitForTextElementToBePresent(new AccountIDDisplay(device));
  const accountID = await device.getTextFromElement(el);
  await device.clickOnElementAll(new CloseSettings(device));
  return { userName, accountID, recoveryPhrase };
}
