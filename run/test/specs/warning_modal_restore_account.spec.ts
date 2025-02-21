import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import {
  SeedPhraseInput,
  BackButton,
  SlowModeRadio,
  ContinueButton,
  AccountRestoreButton,
  WarningModalQuitButton,
} from './locators/onboarding';
import { SupportedPlatformsType } from './utils/open_app';
import { openAppOnPlatformSingleDevice, closeApp } from './utils/open_app';

bothPlatformsIt('Warning modal restore account', 'medium', warningModalRestoreAccount);

async function warningModalRestoreAccount(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
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
    englishStripped('warning').toString(),
    englishStripped('onboardingBackLoadAccount').toString()
  );
  await device.clickOnElementAll(new WarningModalQuitButton(device));
  await closeApp(device);
}
