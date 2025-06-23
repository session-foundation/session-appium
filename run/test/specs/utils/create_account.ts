import type { UserNameType } from '@session-foundation/qa-seeder';
import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { RecoveryPhraseContainer, RevealRecoveryPhraseButton } from '../locators/settings';
import { CreateAccountButton, DisplayNameInput, SlowModeRadio } from '../locators/onboarding';
import { UserSettings } from '../locators/settings';
import { ContinueButton } from '../locators/global';
import { CopyButton } from '../locators/start_conversation';

export const newUser = async (device: DeviceWrapper, userName: UserNameType): Promise<User> => {
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
  // TODO need to retry check every 1s for 5s
  console.warn('about to look for Allow permission in 5s');
  await sleepFor(5000);
  await device.checkPermissions('Allow');
  console.warn('looked for Allow permission');
  await sleepFor(1000);
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
  console.log(`${userName}s recovery phrase is "${recoveryPhrase}"`);
  // Exit Modal
  await device.navigateBack(false);
  await device.clickOnElementAll(new UserSettings(device));
  const accountID = await device.grabTextFromAccessibilityId('Account ID');
  await device.closeScreen(false);
  return { userName, accountID, recoveryPhrase };
};
