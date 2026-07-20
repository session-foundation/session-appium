import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';
import { sleepFor } from '../../../shared/promise_utils';

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
