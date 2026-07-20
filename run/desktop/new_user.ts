// @ported-from tests/automation/setup/new_user.ts
// @port-kind   verbatim
// Only import paths were rewritten to `./` siblings and `chalk` removed.

import { Page } from '@playwright/test';

import { Global, LeftPane, Onboarding, Settings } from './locators';
import { User } from './types';
import {
  checkPathLight,
  clickOn,
  grabTextFromElement,
  pasteIntoInput,
  waitForTestIdWithText,
} from './utils';

export const newUser = async (
  window: Page,
  userName: string,
  awaitOnionPath = true
): Promise<User> => {
  // Create User
  await clickOn(window, Onboarding.createAccountButton);
  // Input username = testuser
  await pasteIntoInput(window, Onboarding.displayNameInput.selector, userName);
  await clickOn(window, Global.continueButton);
  // save recovery phrase
  await clickOn(window, LeftPane.profileButton);
  await clickOn(window, Settings.recoveryPasswordMenuItem);
  await waitForTestIdWithText(window, Settings.recoveryPasswordContainer.selector);
  const recoveryPassword = await grabTextFromElement(
    window,
    'data-testid',
    'recovery-password-seed-modal'
  );
  // const recoveryPhrase = await window.innerText(
  //   '[data-testid=recovery-password-seed-modal]',
  // );
  await clickOn(window, Global.modalCloseButton);
  await clickOn(window, LeftPane.profileButton);
  // Save Account ID to a variable
  let accountid = await window.innerText(`[data-testid="${Settings.accountId.selector}"]`);
  accountid = accountid.replace(/[^0-9a-fA-F]/g, ''); // keep only hex characters

  console.log(
    `${userName}: \n\tAccount ID: "${accountid}" \n\tRecovery password: "${recoveryPassword}"`
  );
  await clickOn(window, Global.modalCloseButton);
  if (awaitOnionPath) {
    await checkPathLight(window);
  }
  return { userName, accountid, recoveryPassword };
};
