import type { StateUser } from '@session-foundation/qa-seeder';

import { sleepFor } from '.';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ContinueButton } from '../locators/global';
import { PlusButton } from '../locators/home';
import {
  AccountRestoreButton,
  DisplayNameInput,
  FastModeRadio,
  SeedPhraseInput,
} from '../locators/onboarding';
import { BaseSetupOptions } from './create_account';
import { handleNotificationPermissions } from './permissions';

/**
 * Wait for the home screen, recovering if the notification prompt turned up too late to be caught.
 *
 * `processPermissions` polls for the prompt over a fixed window. A prompt that arrives after that
 * window closes is never dismissed, and it then sits over the home screen — so the next step fails
 * looking for something it can't reach, with an error that never mentions permissions. Widening the
 * window only makes that rarer: a 5s probe has been seen missing it.
 *
 * So rather than waiting longer, check whether we actually got where we expected and deal with the
 * prompt if we didn't. The probe costs nothing when the home screen is up, which is the usual case.
 */
const waitForHomeScreenAfterOnboarding = async (
  device: DeviceWrapper,
  allowNotificationPermissions: boolean
) => {
  const onHomeScreen = await device.doesElementExist({
    ...new PlusButton(device).build(),
    maxWait: 5_000,
  });
  if (onHomeScreen) {
    return;
  }
  device.info(
    'Home screen not reached after onboarding — checking for a late permission prompt/CTA'
  );
  await handleNotificationPermissions(device, allowNotificationPermissions);
  await device.dismissCTA(true);
  await device.waitForTextElementToBePresent(new PlusButton(device));
};

export const restoreAccount = async (
  device: DeviceWrapper,
  user: StateUser,
  deviceIdentity: string,
  options?: BaseSetupOptions
) => {
  const { allowNotificationPermissions = false } = options || {};
  device.setDeviceIdentity(deviceIdentity);
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(user.seedPhrase, new SeedPhraseInput(device));
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for any notifications to disappear
  await device.clickOnElementAll(new FastModeRadio(device));
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
  await handleNotificationPermissions(device, allowNotificationPermissions);
  // A startup CTA (e.g. the "New Hope for Session" donation appeal) can cover the home
  // screen after restore; dismiss it via its close button so the home screen is reachable.
  await device.dismissCTA(true);
  // Check that we're on the home screen
  await waitForHomeScreenAfterOnboarding(device, allowNotificationPermissions);
};

/**
 * Restore the account linked to seed.
 * If the account isn't found on the network, fail the test.
 */
export const restoreAccountNoFallback = async (
  device: DeviceWrapper,
  recoveryPhrase: string,
  options?: BaseSetupOptions
) => {
  const { allowNotificationPermissions = false } = options || {};
  await device.clickOnElementAll(new AccountRestoreButton(device));
  await device.inputText(recoveryPhrase, new SeedPhraseInput(device));
  // Wait for continue button to become active
  await sleepFor(500);
  // Continue with recovery phrase
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for any notifications to disappear
  await device.clickOnElementAll(new FastModeRadio(device));
  // Click continue on message notification settings
  await device.clickOnElementAll(new ContinueButton(device));
  // Wait for loading animation to look for display name
  await device.waitForLoadingOnboarding();
  // Here the display name input showing up means the account WASN'T found, so the happy path always
  // pays this wait in full — keep it short. `waitForLoadingOnboarding` above has already polled the
  // loading animation away, so the screen has settled and the input would be rendered by now.
  const displayName = await device.doesElementExist({
    ...new DisplayNameInput(device).build(),
    maxWait: 600,
  });
  if (displayName) {
    const network = process.env.DETECTED_NETWORK_TARGET ?? 'unknown';
    throw new Error(`Account not found for seed: "${recoveryPhrase}" (network: ${network})`);
  }
  device.info('Display name found: Loading account');

  // No settle needed before this — processPermissions polls for the modal itself.
  await handleNotificationPermissions(device, allowNotificationPermissions);
  // A startup CTA (e.g. the "New Hope for Session" donation appeal) can cover the home
  // screen after restore; dismiss it via its close button so the home screen is reachable.
  await device.dismissCTA(true);
  // Check that we're on the home screen
  await waitForHomeScreenAfterOnboarding(device, allowNotificationPermissions);
};
