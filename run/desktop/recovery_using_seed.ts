// Import paths rewritten for run/desktop/. Also uses Onboarding.recoveryPhraseInput.selector
// instead of the raw 'recovery-phrase-input' string
import { Page } from '@playwright/test';

import { Global, Onboarding } from './locators';
import {
  clickOn,
  doesElementExist,
  pasteIntoInput,
  waitForLoadingAnimationToFinish,
} from './utils';

export async function recoverFromSeed(
  window: Page,
  recoveryPhrase: string,
  options?: { fallbackName?: string }
) {
  await clickOn(window, Onboarding.iHaveAnAccountButton);
  await pasteIntoInput(window, Onboarding.recoveryPhraseInput.selector, recoveryPhrase);
  await clickOn(window, Global.continueButton);
  await waitForLoadingAnimationToFinish(window, 'loading-animation');
  const displayNameInput = await doesElementExist(window, Onboarding.displayNameInput);
  if (displayNameInput) {
    if (!options?.fallbackName) {
      throw new Error(`Display name was not found when restoring from seed`);
    }
    // Fallback for when name might be missing (but it's okay)
    await pasteIntoInput(window, Onboarding.displayNameInput.selector, options.fallbackName);
    await clickOn(window, Global.continueButton);
  }
  return { window };
}
