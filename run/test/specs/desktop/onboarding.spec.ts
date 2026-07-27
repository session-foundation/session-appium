// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { Global, Onboarding } from '../../../desktop/locators';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

sessionTestOneWindow('Warning modal new account', async ([alice]) => {
  await alice.clickOn(Onboarding.createAccountButton);
  await alice.clickOn(Global.backButton);
  await alice.checkModalStrings(
    tStripped('warning'),
    tStripped('onboardingBackAccountCreation'),
    'confirmModal'
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('quitButton'));
  // Wait for window to close (confirms restart was triggered).
  await alice.waitForWindowClosed(5000);

  // Test ends - app is restarting but we can't verify the aftermath. Playwright cannot
  // keep track of Electron's `window.restart` IPC call so this will have to do.
});

sessionTestOneWindow('Warning modal restore account', async ([alice]) => {
  const seedPhrase =
    'eldest fazed hybrid buzzer nasty domestic digit pager unusual purged makeup assorted domestic';
  await alice.clickOn(Onboarding.iHaveAnAccountButton);
  await alice.pasteIntoInput('recovery-phrase-input', seedPhrase);
  await alice.clickOn(Global.continueButton);
  await alice.clickOn(Global.backButton);
  await alice.checkModalStrings(
    tStripped('warning'),
    tStripped('onboardingBackLoadAccount'),
    'confirmModal'
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('quitButton'));
  // Wait for window to close (confirms restart was triggered).
  await alice.waitForWindowClosed(5000);
});
