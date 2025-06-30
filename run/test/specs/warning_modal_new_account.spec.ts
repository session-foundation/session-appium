import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  BackButton,
  CreateAccountButton,
  DisplayNameInput,
  SlowModeRadio,
  WarningModalQuitButton,
} from './locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { ContinueButton } from '../specs/locators/global';
import type { TestInfo } from '@playwright/test';

// These modals no longer exist in groups rebuild for iOS
androidIt({
  title: 'Warning modal on new account',
  risk: 'medium',
  testCb: warningModalNewAccount,
  countOfDevicesNeeded: 1,
});

async function warningModalNewAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
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
    englishStrippedStr('warning').toString(),
    englishStrippedStr('onboardingBackAccountCreation').toString()
  );
  await device.clickOnElementAll(new WarningModalQuitButton(device));
  await closeApp(device);
}
