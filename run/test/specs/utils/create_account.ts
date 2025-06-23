import type { UserNameType } from '@session-foundation/qa-seeder';
import { sleepFor } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { RecoveryPhraseContainer, RevealRecoveryPhraseButton } from '../locators/settings';
import { CreateAccountButton, DisplayNameInput, SlowModeRadio } from '../locators/onboarding';
import { UserSettings } from '../locators/settings';
import { ContinueButton } from '../locators/global';
import { CopyButton } from '../locators/start_conversation';
import test from '@playwright/test';

export const newUser = async (device: DeviceWrapper, userName: UserNameType): Promise<User> => {
  return await test.step(`Create new user: ${userName}`, async () => {
    let accountID = '';
    let recoveryPhrase = '';
    await test.step('Tap Create Account button', async () => {
      await device.clickOnElementAll(new CreateAccountButton(device));
    });
    await test.step('Enter Display Name', async () => {
      await device.inputText(userName, new DisplayNameInput(device));
      await device.clickOnElementAll(new ContinueButton(device));
    });
    await test.step('Choose Slow Mode for Notifications', async () => {
      // Want to choose 'Slow Mode' so notifications don't interrupt test
      await device.clickOnElementAll(new SlowModeRadio(device));
      await device.clickOnElementAll(new ContinueButton(device));
    });
    // TODO need to retry check every 1s for 5s
    await test.step('Handle permission prompt if visible', async () => {
      console.warn('about to look for Allow permission in 5s');
      await sleepFor(5000);
      await device.checkPermissions('Allow');
      console.warn('looked for Allow permission');
      await sleepFor(1000);
    });
    await test.step(`Save user's recovery password`, async () => {
      await device.waitForTextElementToBePresent(new RevealRecoveryPhraseButton(device));
      await device.clickOnElementAll(new RevealRecoveryPhraseButton(device));
      //Save recovery password
      const recoveryPhraseContainer = await device.clickOnElementAll(
        new RecoveryPhraseContainer(device)
      );
      await device.onAndroid().clickOnElementAll(new CopyButton(device));
      // Save recovery phrase as variable
      recoveryPhrase = await device.getTextFromElement(recoveryPhraseContainer);
      console.log(`${userName}s recovery phrase is "${recoveryPhrase}"`);
      await device.navigateBack(false);
    });
    await test.step(`Save user's Account ID`, async () => {
      await device.clickOnElementAll(new UserSettings(device));
      accountID = await device.grabTextFromAccessibilityId('Account ID');
      await device.closeScreen(false);
    });
    return { userName, accountID, recoveryPhrase };
  });
};
