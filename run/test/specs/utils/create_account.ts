import type { UserNameType } from '@session-foundation/qa-seeder';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { AccountIDDisplay, ContinueButton } from '../locators/global';
import { CreateAccountButton, DisplayNameInput, SlowModeRadio } from '../locators/onboarding';
import { RecoveryPhraseContainer, RevealRecoveryPhraseButton } from '../locators/settings';
import { UserSettings } from '../locators/settings';
import { CopyButton } from '../locators/start_conversation';
import { handlePermissions } from './permissions';

export type BaseSetupOptions = {
  allowNotificationPermissions?: boolean;
};

export type NewUserSetupOptions = BaseSetupOptions & {
  saveUserData?: boolean;
};

export async function newUser(
  device: DeviceWrapper,
  userName: UserNameType,
  options?: NewUserSetupOptions
): Promise<User> {
  const { saveUserData = true, allowNotificationPermissions = false } = options || {};
  device.setDeviceIdentity(`${userName.toLowerCase()}1`);
  // Click create session ID
  await device.clickOnElementAll(new CreateAccountButton(device));
  // Input username
  await device.inputText(userName, new DisplayNameInput(device));
  // Click continue
  await device.clickOnElementAll(new ContinueButton(device));
  // Choose message notification options
  // Want to choose 'Slow Mode' so notifications don't interrupt test
  await device.clickOnElementAll(new SlowModeRadio(device));
  // Select Continue to save notification settings
  await device.clickOnElementAll(new ContinueButton(device));
  // Handle permissions based on the flag
  await handlePermissions(device, allowNotificationPermissions);
  // Some tests don't need to save the Account ID and Recovery Password
  if (!saveUserData) {
    return { userName, accountID: 'not_needed', recoveryPhrase: 'not_needed' };
  }

  // Click on 'continue' button to open recovery phrase modal
  await device.waitForTextElementToBePresent(new RevealRecoveryPhraseButton(device));
  await device.clickOnElementAll(new RevealRecoveryPhraseButton(device));
  //Save recovery password
  const recoveryPhraseContainer = await device.clickOnElementAll(
    new RecoveryPhraseContainer(device)
  );
  await device.onAndroid().clickOnElementAll(new CopyButton(device));
  // Save recovery phrase as variable
  const recoveryPhrase = await device.getTextFromElement(recoveryPhraseContainer);
  device.log(`${userName}s recovery phrase is "${recoveryPhrase}"`);
  // Exit Modal
  await device.navigateBack(false);
  await device.clickOnElementAll(new UserSettings(device));
  const el = await device.waitForTextElementToBePresent(new AccountIDDisplay(device))
  const accountID = await device.getTextFromElement(el);
  await device.closeScreen(false);
  return { userName, accountID, recoveryPhrase };
}
