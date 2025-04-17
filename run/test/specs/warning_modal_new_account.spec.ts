import { englishStripped } from '../../localizer/Localizer';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  BackButton,
  ContinueButton,
  CreateAccountButton,
  DisplayNameInput,
  SlowModeRadio,
  WarningModalQuitButton,
} from './locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
// These modals no longer exist in groups rebuild for iOS
androidIt('Warning modal new account', 'medium', warningModalNewAccount);

async function warningModalNewAccount(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await device.clickOnElementAll(new CreateAccountButton(device));
  await device.inputText(USERNAME.ALICE, new DisplayNameInput(device));
  await device.clickOnElementAll(new ContinueButton(device));
  // Checking that we're on the Message Notifications screen
  await device.doesElementExist(new SlowModeRadio(device));
  // Pressing Back on the Message Notifications screen
  await device.clickOnElementAll(new BackButton(device));
  // Verifying that pressing Back from the Message Notifications screen does not bring up a modal but instead shows the Display Name input field
  await device.doesElementExist(new DisplayNameInput(device));
  // Pressing Back on the Display Name screen to trigger the Warning modal
  await device.clickOnElementAll(new BackButton(device));
  await device.checkModalStrings(
    englishStripped('warning').toString(),
    englishStripped('onboardingBackAccountCreation').toString()
  );
  await device.clickOnElementAll(new WarningModalQuitButton(device));
  await closeApp(device);
}
