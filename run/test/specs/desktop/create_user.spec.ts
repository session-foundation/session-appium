// @ported-from tests/automation/create_user.spec.ts
// @port-kind   spec

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';

sessionTestOneWindow('Create User', async ([window]) => {
  // Create User
  const userA = await window.onboard('Alice', false);
  // Open profile tab
  await window.clickOn(LeftPane.profileButton);
  await sleepFor(100, true);
  // check username matches
  await window.waitForTestIdWithText(Settings.displayName.selector, userA.userName);
  // check Account ID matches
  await window.waitForTestIdWithText(Settings.accountId.selector, userA.accountid);
  // exit profile modal
  await window.clickOn(Global.modalCloseButton);
  // go to settings section
  await window.clickOn(LeftPane.settingsButton);
  // check recovery phrase matches
  await window.clickOn(Settings.recoveryPasswordMenuItem);
  await window.waitForTestIdWithText(
    Settings.recoveryPasswordContainer.selector,
    userA.recoveryPassword
  );
});
