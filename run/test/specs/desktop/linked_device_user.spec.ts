// @ported-from tests/automation/linked_device_user.spec.ts
// @port-kind   spec

import { Page } from '@playwright/test';

import { forceCloseAllWindows } from '../../../desktop/closeWindows';
import { linkedDevice } from '../../../desktop/linked_device';
import { Conversation, Global, HomeScreen, LeftPane, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { compareElementScreenshot } from '../../../desktop/screenshot';
import {
  sessionTestOneWindow,
  test_Alice_2W,
  test_Alice_2W_Bob_1W,
} from '../../../desktop/sessionTest';
import {
  doWhileWithMax,
  hasElementBeenDeleted,
  waitForTestIdWithText,
} from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

sessionTestOneWindow('Link a device', async ([alice]) => {
  let aliceWindow2: Page | undefined;
  try {
    const userA = await alice.onboard('Alice');
    aliceWindow2 = await linkedDevice(userA.recoveryPassword); // not using fixture here as we want to check the behavior finely
    await alice.clickOn(LeftPane.profileButton);
    // Verify Username
    await alice.waitForTestIdWithText(Settings.displayName.selector, userA.userName);
    // Verify Account ID
    await alice.waitForTestIdWithText(Settings.accountId.selector, userA.accountid);
    // exit profile modal
    await alice.clickOn(Global.modalCloseButton);
    // You're almost finished isn't displayed
    const errorDesc = 'Should not be found';
    try {
      const elemShouldNotBeFound = aliceWindow2.locator('[data-testid=reveal-recovery-phrase]');
      if (elemShouldNotBeFound) {
        console.error('Continue to save recovery phrase not found, excellent news');
        throw new Error(errorDesc);
      }
    } catch (e) {
      if ((e as Error).message !== errorDesc) {
        // this is NOT ok
        throw e;
      }
    }
  } finally {
    if (aliceWindow2) {
      await forceCloseAllWindows([aliceWindow2]);
    }
  }
});

test_Alice_2W('Changed username syncs', async ({ alice, alice2 }) => {
  const newUsername = 'Tiny bubble';
  await alice.clickOn(LeftPane.profileButton);
  // Click on pencil icon
  await alice.clickOn(Settings.displayName);
  // Replace old username with new username
  await alice.pasteIntoInput(Settings.displayNameInput.selector, newUsername);
  // Press enter to confirm change
  await alice.clickOnMatchingText(tStripped('save'));

  // Check username change in window B
  // Click on profile settings in window B
  // Waiting for the username to change
  await doWhileWithMax(15000, 500, 'waiting for updated username in profile dialog', async () => {
    await alice2.clickOn(LeftPane.profileButton);
    // Verify username has changed to new username
    try {
      await alice2.waitForTestIdWithText(Settings.displayName.selector, newUsername, 100);
      return true;
    } catch (_e) {
      // if waitForTestIdWithText doesn't find the right username, close the window and retry
      return false;
    } finally {
      await alice2.clickOnElement({
        strategy: 'data-testid',
        selector: 'modal-close-button',
      });
    }
  });
});

test_Alice_2W('Avatar syncs', async ({ alice, alice2 }, testInfo) => {
  await alice.clickOn(LeftPane.profileButton);
  // Click on current avatar
  await alice.clickOn(Settings.displayName);
  await alice.clickOn(Settings.imageUploadSection);
  await alice.clickOn(Settings.imageUploadClick);
  // allow for the image to be resized before we try to save it
  await sleepFor(500);
  await alice.clickOn(Settings.saveProfileUpdateButton);
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  await alice.clickOnMatchingText(tStripped('save'));
  await alice.clickOn(Global.modalCloseButton);

  const leftpaneAvatarContainer = await waitForTestIdWithText(
    alice2.getPage(),
    LeftPane.profileButton.selector
  );

  await compareElementScreenshot({
    element: leftpaneAvatarContainer,
    snapshotName: 'avatar-updated-blue.jpeg',
    testInfo,
  });
});

test_Alice_2W_Bob_1W('Contacts syncs', async ({ alice, alice2, bob }) => {
  await alice.createContactWith(bob);
  // linked device (aliceWindow2)
  await alice2.waitForTestIdWithText('module-conversation__user__profile-name', bob.userName);
  console.info('Contacts correctly synced');
});

test_Alice_2W_Bob_1W('Blocked user syncs', async ({ alice, alice2, bob }) => {
  const testMessage = 'Testing blocking functionality for linked device';

  await alice.createContactWith(bob);
  await alice.sendMessage(testMessage);
  // Navigate to conversation on linked device and check for message from user A to user B
  await alice2.rightClickOnWithText(HomeScreen.conversationItemName, bob.userName);
  // Select block
  await alice2.clickOnWithText(Global.contextMenuItem, tStripped('block'));
  // Check modal strings
  await alice2.checkModalStrings(
    tStripped('block'),
    tStripped('blockDescription', { name: bob.userName })
  );
  await alice2.clickOnWithText(Global.confirmButton, tStripped('block'));
  // Verify the user was moved to the blocked contact list
  await alice.waitForMatchingPlaceholder(
    Conversation.messageInput.selector,
    tStripped('blockBlockedDescription')
  );
  // Check linked device for blocked contact in settings screen
  // Click on settings tab
  await alice2.clickOn(LeftPane.settingsButton);
  await alice2.clickOn(Settings.conversationsMenuItem);
  // a conf sync job can take 30s (if the last one failed) +  10s polling to show a change on a linked device.
  await alice2.clickOn(Settings.blockedContactsButton, {
    maxWait: 50_000,
  });
  // Check if user B is in blocked contact list
  await alice2.waitForTestIdWithText(Global.contactItem.selector, bob.userName);
});

test_Alice_2W_Bob_1W('Deleted conversation syncs', async ({ alice, alice2, bob }) => {
  // Create contact and send new message
  await alice.createContactWith(bob);
  await Promise.all(
    [alice, alice2, bob].map(w =>
      w.clickOnElement({
        strategy: 'data-testid',
        selector: 'new-conversation-button',
      })
    )
  );
  await Promise.all([
    alice.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
    bob.waitForTestIdWithText(Global.contactItem.selector, alice.userName),
    alice2.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
  ]);
  await Promise.all([alice, alice2, bob].map(w => w.clickOn(Global.backButton)));
  // Delete contact
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, bob.userName);
  await alice.clickOnWithText(Global.contextMenuItem, tStripped('conversationsDelete'));
  await alice.checkModalStrings(
    tStripped('conversationsDelete'),
    tStripped('deleteConversationDescription', { name: bob.userName })
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('delete'));
  // Check if conversation is deleted
  // Need to wait for deletion to propagate to linked device
  await Promise.all(
    [alice, alice2].map(w =>
      hasElementBeenDeleted(w.getPage(), HomeScreen.conversationItemName, {
        maxWait: 10_000,
        text: bob.userName,
      })
    )
  );
});

test_Alice_2W('Hide note to self syncs', async ({ alice, alice2 }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.pasteIntoInput(HomeScreen.newMessageAccountIDInput.selector, alice.accountId);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  await alice.waitForTestIdWithText('header-conversation-name', tStripped('noteToSelf'));
  await alice.sendMessage('Testing note to self');
  // Check if note to self is visible in linked device
  await sleepFor(1000);
  await alice2.waitForTestIdWithText(
    HomeScreen.conversationItemName.selector,
    tStripped('noteToSelf')
  );
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, tStripped('noteToSelf'));
  await alice.clickOnWithText(Global.contextMenuItem, tStripped('noteToSelfHide'));
  await alice.checkModalStrings(
    tStripped('noteToSelfHide'),
    tStripped('noteToSelfHideDescription')
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('hide'));
  // Check linked device for hidden note to self
  await sleepFor(1000);
  await Promise.all([
    hasElementBeenDeleted(alice.getPage(), HomeScreen.conversationItemName, {
      maxWait: 5000,
      text: tStripped('noteToSelf'),
    }),
    hasElementBeenDeleted(alice2.getPage(), HomeScreen.conversationItemName, {
      maxWait: 15_000,
      text: tStripped('noteToSelf'),
    }),
  ]);
});
