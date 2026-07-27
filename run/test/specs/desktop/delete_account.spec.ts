import { Page } from '@playwright/test';

import { forceCloseAllWindows } from '../../../desktop/closeWindows';
import { DesktopWrapper } from '../../../desktop/DesktopWrapper';
import { Global, HomeScreen, LeftPane, Onboarding, Settings } from '../../../desktop/locators';
import { openAppsAndWaitWindows } from '../../../desktop/open';
import { recoverFromSeed } from '../../../desktop/recovery_using_seed';
import { sessionTestTwoWindows } from '../../../desktop/sessionTest';
import { hasElementBeenDeleted } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';
import { sleepFor } from '../../../shared/promise_utils';

sessionTestTwoWindows('Delete account from swarm', async ([windowA, windowB]) => {
  let restoringWindows: Array<Page> | undefined;
  try {
    const [userA, userB] = await Promise.all([windowA.onboard('Alice'), windowB.onboard('Bob')]);
    const testMessage = `${userA.userName} to ${userB.userName}`;
    const testReply = `${userB.userName} to ${userA.userName}`;
    // Create contact and send new message
    await Promise.all([
      windowA.sendNewMessage(userB.accountid, testMessage),
      windowB.sendNewMessage(userA.accountid, testReply),
    ]);
    // Delete all data from device
    // Click on settings tab
    await windowA.clickOn(LeftPane.settingsButton);
    // Click on clear all data
    await windowA.clickOnWithText(Settings.clearDataMenuItem, tStripped('sessionClearData'));
    // Select entire account
    await windowA.clickOnWithText(
      Settings.clearDeviceAndNetworkRadial,
      tStripped('clearDeviceAndNetwork')
    );
    // Confirm deletion by clicking Clear, twice
    await windowA.clickOnMatchingText(tStripped('clear'));
    await windowA.clickOnMatchingText(tStripped('clear'));
    await windowA.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
    // await sleepFor(7500);
    // Wait for window to close and reopen

    // await windowA.close();
    restoringWindows = await openAppsAndWaitWindows(1); // not using sessionTest here as we need to close and reopen one of the window
    const [restoringWindowPage] = restoringWindows;
    const restoringWindow = new DesktopWrapper(restoringWindowPage, 'alice-restoring');
    // Sign in with deleted account and check that nothing restores
    await restoringWindow.clickOn(Onboarding.iHaveAnAccountButton);
    // Fill in recovery phrase
    await restoringWindow.pasteIntoInput(
      Onboarding.recoveryPhraseInput.selector,
      userA.recoveryPassword
    );
    // Enter display name
    await restoringWindow.clickOn(Global.continueButton);
    await restoringWindow.waitForLoadingAnimationToFinish('loading-animation');

    await restoringWindow.pasteIntoInput(Onboarding.displayNameInput.selector, userA.userName);
    // Click continue
    await restoringWindow.clickOn(Global.continueButton);
    await sleepFor(5000, true); // just to allow any messages from our swarm to show up

    // Need to verify that no conversation is found at all

    await hasElementBeenDeleted(restoringWindow.getPage(), HomeScreen.conversationItemName, {
      maxWait: 5_000,
    });

    await restoringWindow.clickOn(HomeScreen.plusButton); // Expect contacts list to be empty

    await hasElementBeenDeleted(restoringWindow.getPage(), Global.contactItem, {
      maxWait: 10_000,
    });
  } finally {
    if (restoringWindows) {
      await forceCloseAllWindows(restoringWindows);
    }
  }
});

sessionTestTwoWindows('Delete account from device', async ([windowA, windowB]) => {
  let restoringWindows: Array<Page> | undefined;
  try {
    const [userA, userB] = await Promise.all([windowA.onboard('Alice'), windowB.onboard('Bob')]);
    // Create contact and send new message
    await windowA.createContactWith(windowB);
    // Allow some time so that Alice gets to push her first config message to the network
    await sleepFor(5000, true);
    // Delete all data from device
    // Click on settings tab
    await windowA.clickOn(LeftPane.settingsButton);
    // Click on clear all data
    await windowA.clickOnWithText(Settings.clearDataMenuItem, tStripped('sessionClearData'));
    // Keep 'Clear Device only' selection

    await windowA.clickOnMatchingText(tStripped('clearDeviceOnly'));
    // Confirm deletion by clicking Clear, twice
    await windowA.clickOnMatchingText(tStripped('clear'));
    await windowA.clickOnMatchingText(tStripped('clear'));
    restoringWindows = await openAppsAndWaitWindows(1);
    const [restoringWindowPage] = restoringWindows;
    const restoringWindow = new DesktopWrapper(restoringWindowPage, 'alice-restoring');
    // Sign in with deleted account and check that nothing restores
    await recoverFromSeed(restoringWindow.getPage(), userA.recoveryPassword);
    await sleepFor(5000, true); // just to allow any messages from our swarm to show up
    // Check if message from user B is restored

    await restoringWindow.waitForElement({
      locator: HomeScreen.conversationItemName,
      options: {
        maxWaitMs: 10_000,
        shouldLog: true,
        text: userB.userName,
      },
    });
    // Check if contact is available in contacts section
    await restoringWindow.clickOn(HomeScreen.plusButton);
    await restoringWindow.waitForElement({
      locator: Global.contactItem,
      options: {
        maxWaitMs: 1000,
        shouldLog: true,
        text: userB.userName,
      },
    });
    console.log('Contacts have been restored');
  } finally {
    if (restoringWindows) {
      await forceCloseAllWindows(restoringWindows);
    }
  }
});
