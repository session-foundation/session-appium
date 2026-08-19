// Only import paths were rewritten to `./` siblings and `chalk` removed.

import type { StateUser, UserNameType } from '@session-foundation/qa-seeder';

import { Page } from '@playwright/test';

import { isAccountId } from '../shared/constants';
import { mnemonicToSeedHex, padSeed } from '../shared/pro_grant';
import { Global, LeftPane, Onboarding, Settings } from './locators';
import {
  checkPathLight,
  clickOn,
  grabTextFromElement,
  pasteIntoInput,
  waitForTestIdWithText,
} from './utils';

export const newUser = async (
  window: Page,
  userName: UserNameType,
  awaitOnionPath = true
): Promise<StateUser> => {
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
  const seed = padSeed(mnemonicToSeedHex(recoveryPassword));
  if (!isAccountId(accountid)) {
    throw new Error(`newUser: invalid Session ID "${accountid}"`);
  }
  return { userName, sessionId: accountid, seedPhrase: recoveryPassword, seed };
};
