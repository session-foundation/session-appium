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
  // Being asked for a display name means the restore did NOT find the account's profile on the network.
  // That is an error by default, and usually a real one: the account's config never reached the swarm.
  // For a seeded account it means the seeder did not push, which would otherwise surface much later as a
  // spec failing on a name it never set.
  if (displayNameInput) {
    if (!options?.fallbackName) {
      throw new Error(
        'Restoring from seed asked for a display name, so the profile was not found on the network. ' +
          'For a seeded account this usually means the seeder did not push its config. ' +
          'If the spec genuinely does not care about the name, pass `fallbackName` to say so.'
      );
    }
    // Opted in: the caller has stated the name is not part of what it asserts, so type past the prompt.
    await pasteIntoInput(window, Onboarding.displayNameInput.selector, options.fallbackName);
    await clickOn(window, Global.continueButton);
  }
  return { window };
}
