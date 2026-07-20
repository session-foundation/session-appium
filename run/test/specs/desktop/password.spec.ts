// @ported-from tests/automation/password.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { test_Alice_1W_no_network } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

const testPassword = '123456';
/**
 * A password with spaces around. We don't trim anymore the passwords. So if the user enters a password with spaces around the text, so be it.
 */
const testPasswordSpace = '  123456 ';
const newTestPassword = '789101112';

async function expectRecoveryPhraseToBeVisible(alice: DesktopWrapper, recoveryPhrase: string) {
  await alice.waitForTestIdWithText(
    Settings.recoveryPasswordContainer.selector,
    recoveryPhrase,
    1000
  );
}

test_Alice_1W_no_network('Set Password', async ({ alice }) => {
  // Click on settings tab
  await alice.clickOn(LeftPane.settingsButton);
  // Click on privacy
  await alice.clickOn(Settings.privacyMenuItem);
  // Click set password
  await alice.clickOn(Settings.setPasswordSettingsButton);
  // Enter password
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPassword);
  // Confirm password
  await alice.pasteIntoInput(Settings.confirmPasswordInput.selector, testPassword);
  await alice.clickOn(Settings.setPasswordButton);
  // Check toast notification
  await alice.waitForTestIdWithText(
    Global.toast.selector,
    tStripped('passwordSetDescriptionToast')
  );
  // Click on settings tab
  await sleepFor(300, true);
  await alice.clickOn(Global.modalCloseButton);
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  await sleepFor(300, true);

  // Type password into input field and validate it
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPassword);
  // Click Done
  await alice.clickOnMatchingText(tStripped('enter'));

  // check that the seed is visible now
  await expectRecoveryPhraseToBeVisible(alice, alice.getUser().recoveryPassword);
  await alice.clickOn(Global.modalCloseButton);
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.privacyMenuItem);
  // Change password
  await alice.clickOn(Settings.changePasswordSettingsButton);

  // Enter old password
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPassword);
  // Enter new password
  await alice.pasteIntoInput(Settings.confirmPasswordInput.selector, newTestPassword);
  // Confirm new password
  await alice.pasteIntoInput(Settings.reConfirmPasswordInput.selector, newTestPassword);
  // Press enter on keyboard
  await alice.getPage().keyboard.press('Enter');
  // Check toast notification for 'changed password'
  await alice.waitForTestIdWithText(
    Global.toast.selector,
    tStripped('passwordChangedDescriptionToast')
  );
});

test_Alice_1W_no_network('Wrong Password', async ({ alice }) => {
  const { recoveryPassword } = alice.getUser();
  // Check if incorrect password works
  // Click on settings tab
  await alice.clickOn(LeftPane.settingsButton);
  // Click on privacy
  await alice.clickOn(Settings.privacyMenuItem);
  // Click set password
  await alice.clickOn(Settings.setPasswordSettingsButton);
  // Enter password
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPassword);
  // Confirm password
  await alice.pasteIntoInput(Settings.confirmPasswordInput.selector, testPassword);
  await alice.clickOn(Settings.setPasswordButton);
  // Click on recovery phrase tab
  await sleepFor(5000);
  await alice.clickOn(Global.modalBackButton);
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  // Type password into input field
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPassword);
  // Confirm the password
  await alice.clickOn(Global.confirmButton);
  // this should print the recovery phrase
  await expectRecoveryPhraseToBeVisible(alice, recoveryPassword);

  await alice.clickOn(Global.modalBackButton);
  await sleepFor(500);
  // Click on recovery phrase tab
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  // Try with incorrect password
  await alice.pasteIntoInput(Settings.passwordInput.selector, newTestPassword);
  // Confirm the password
  await alice.clickOn(Global.confirmButton);
  // this should NOT print the recovery phrase

  await alice.hasElementPoppedUpThatShouldnt(Settings.recoveryPasswordContainer, recoveryPassword);

  //  Incorrect password below input showing?
  await alice.waitForTestIdWithText(Global.errorMessage.selector, tStripped('passwordIncorrect'));
  await alice.clickOn(Global.modalCloseButton);
  await sleepFor(100);
  // Click on recovery phrase tab
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  //  No password entered
  await alice.clickOn(Global.confirmButton);
  //  Banner should ask for password to be entered
  await alice.waitForTestIdWithText(Global.errorMessage.selector, tStripped('passwordIncorrect'));
});

test_Alice_1W_no_network('Do not trim spaces from password', async ({ alice }) => {
  // Click on settings tab
  await alice.clickOn(LeftPane.settingsButton);
  // Click on privacy
  await alice.clickOn(Settings.privacyMenuItem);
  // Click set password
  await alice.clickOn(Settings.setPasswordSettingsButton);
  // Enter password
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPasswordSpace);
  // Confirm password
  await alice.pasteIntoInput(Settings.confirmPasswordInput.selector, testPasswordSpace);
  await alice.clickOn(Settings.setPasswordButton);
  // Check toast notification
  await alice.waitForTestIdWithText(
    Global.toast.selector,
    tStripped('passwordSetDescriptionToast')
  );
  // Click on settings tab
  await sleepFor(300, true);
  await alice.clickOn(Global.modalCloseButton);
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  await sleepFor(300, true);

  // Type password into input field and validate it
  await alice.pasteIntoInput(Settings.passwordInput.selector, testPasswordSpace);
  // Click Done
  await alice.clickOnMatchingText(tStripped('enter'));

  // check that the seed is visible now
  await expectRecoveryPhraseToBeVisible(alice, alice.getUser().recoveryPassword);
  await alice.clickOn(Global.modalCloseButton);
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.privacyMenuItem);
});
