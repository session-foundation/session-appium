import type { StateUser, UserNameType } from '@session-foundation/qa-seeder';

import { isAccountId } from '../../shared/constants';
import { mnemonicToSeedHex, padSeed } from '../../shared/pro_grant';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CloseSettings } from '../locators';
import { AccountIDDisplay, ContinueButton, CTAHeading } from '../locators/global';
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
): Promise<StateUser> {
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
  } else {
    await device.clickOnElementAll(new SlowModeRadio(device));
  }
  await device.clickOnElementAll(new ContinueButton(device));
  // Handle permissions based on the flag
  await handleNotificationPermissions(device, allowNotificationPermissions);
  if (!fastMode) {
    await handleBackgroundPermissions(device, allowBackgroundPermissions);
  }
  // Some tests don't need to save the Account ID and Recovery Password
  if (!saveUserData) {
    // Sentinels rather than real values: `makeAccountPro` guards on the `05` prefix, so this
    // reads as "not provided" instead of silently minting against the wrong account.
    return {
      userName,
      sessionId: 'not_needed' as `05${string}`,
      seedPhrase: 'not_needed',
      seed: new Uint8Array(),
    };
  }

  const harvested = await harvestAccountData(device);
  return { userName, ...harvested, seed: padSeed(mnemonicToSeedHex(harvested.seedPhrase)) };
}

/**
 * Read the account's credentials out of the settings screen, and leave it as it was found.
 *
 * Separate from account CREATION because the two collide. A fixture that arms a CTA on app open has the
 * modal over the settings list by the time this runs, and no spec code has had a chance to dismiss it —
 * so a spec asserting that CTA cannot use the combined path at all. Call `newUser` with
 * `saveUserData: false`, deal with the CTA on the spec's own terms, then call this.
 *
 * Left as `newUser`'s default so the common case is unchanged.
 */
export async function harvestAccountData(
  device: DeviceWrapper
): Promise<Pick<StateUser, 'seedPhrase' | 'sessionId'>> {
  // Open recovery phrase modal and save recovery phrase
  await device.clickOnElementAll(new UserSettings(device));
  await device.onIOS().scrollDown();
  try {
    await device.clickOnElementAll(new RecoveryPasswordMenuItem(device));
  } catch (error) {
    // The row is reliably present on this screen, so the interesting failure is something covering it.
    // Named here because the raw error quotes a locator the spec never mentions, in a helper it did not
    // know it was inside — which reads as a missing row rather than as an obstructed one.
    const ctaPresent = await device.doesElementExist({
      ...new CTAHeading(device).build(),
      maxWait: 1000,
    });
    if (ctaPresent) {
      throw new Error(
        'harvestAccountData: a CTA modal is covering the settings list. This fixture arms a CTA on app ' +
          'open, so create the account with `saveUserData: false`, handle the CTA, then call this.'
      );
    }
    throw error;
  }
  const recoveryPhraseContainer = await device.clickOnElementAll(
    new RecoveryPhraseContainer(device)
  );
  const recoveryPhrase = await device.getTextFromElement(recoveryPhraseContainer);
  device.log(`Recovery phrase is "${recoveryPhrase}"`);
  await device.navigateBack(false);
  await device.scrollUp();
  // Get Account ID from User Settings
  const el = await device.waitForTextElementToBePresent(new AccountIDDisplay(device));
  // Harvested from on-screen text, so its `05…` shape is the app's guarantee rather than the compiler's.
  const sessionIdText = await device.getTextFromElement(el);
  if (!isAccountId(sessionIdText)) {
    throw new Error(`harvestAccountData: invalid Session ID "${sessionIdText}"`);
  }
  const sessionId = sessionIdText;
  await device.clickOnElementAll(new CloseSettings(device));
  return { sessionId, seedPhrase: recoveryPhrase };
}
