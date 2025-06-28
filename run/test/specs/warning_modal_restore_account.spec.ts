import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import {
  AccountRestoreButton,
  BackButton,
  ContinueButton,
  SeedPhraseInput,
  SlowModeRadio,
  WarningModalQuitButton,
} from './locators/onboarding';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { TestInfo } from '@playwright/test';
// These modals no longer exist in groups rebuild for iOS
androidIt({
  title: 'Warning modal on restore account',
  risk: 'medium',
  testCb: warningModalRestoreAccount,
  countOfDevicesNeeded: 1,
});

async function warningModalRestoreAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const seedPhrase =
    'eldest fazed hybrid buzzer nasty domestic digit pager unusual purged makeup assorted domestic';
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(seedPhrase, new SeedPhraseInput(device));
  await device.clickOnElementAll(new ContinueButton(device));
  // Checking that we're on the Message Notifications screen
  await device.doesElementExist(new SlowModeRadio(device).build());
  // Pressing Back on the Message Notifications screen to trigger the Warning modal
  await device.clickOnElementAll(new BackButton(device));
  await device.checkModalStrings(
    englishStrippedStr('warning').toString(),
    englishStrippedStr('onboardingBackLoadAccount').toString()
  );
  await device.clickOnElementAll(new WarningModalQuitButton(device));
  await closeApp(device);
}
