// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { Onboarding } from '../../../desktop/locators';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';

sessionTestOneWindow('Tiny test', async ([windowA]) => {
  await windowA.clickOn(Onboarding.createAccountButton);
});
