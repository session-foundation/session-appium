// @ported-from tests/automation/user_actions.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { expect } from '@playwright/test';

import { Conversation, Global, HomeScreen, LeftPane, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { compareElementScreenshot } from '../../../desktop/screenshot';
import {
  test_Alice_1W_Bob_1W,
  test_Alice_1W_no_network,
  test_Alice_2W,
} from '../../../desktop/sessionTest';
import {
  controlOrMetaFor,
  doesElementExist,
  hasElementBeenDeleted,
  waitForTestIdWithText,
} from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

const cancelString = tStripped('cancel');
const saveString = tStripped('save');
const removeString = tStripped('remove');

test_Alice_1W_Bob_1W('Block user in conversation list', async ({ alice, bob }) => {
  // Create contact and send new message
  await alice.createContactWith(bob);
  // Check to see if User B is a contact
  await alice.clickOn(HomeScreen.plusButton);
  await alice.waitForTestIdWithText(Global.contactItem.selector, bob.userName);
  // he is a contact, close the new conversation button tab as there is no right click allowed on it
  await alice.clickOn(Global.backButton);
  // then right click on the contact conversation list item to show the menu
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, bob.userName);
  // Select block
  await alice.clickOnWithText(Global.contextMenuItem, tStripped('block'));
  // Check modal strings
  await alice.checkModalStrings(
    tStripped('block'),
    tStripped('blockDescription', { name: bob.userName })
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('block'));
  // Verify the user was moved to the blocked contact list
  // Click on settings tab
  await alice.clickOn(LeftPane.settingsButton);
  // click on settings section 'conversation'
  await alice.clickOn(Settings.conversationsMenuItem);
  // Navigate to blocked users tab'
  await alice.clickOn(Settings.blockedContactsButton);
  // select the contact to unblock by clicking on it by name
  await alice.clickOnWithText(Global.contactItem, bob.userName);
  // Unblock user by clicking on unblock
  await alice.clickOn(Settings.unblockButton);
  // make sure the confirm dialogs shows up
  await alice.checkModalStrings(
    tStripped('blockUnblock'),
    tStripped('blockUnblockName', { name: bob.userName }),
    'blockOrUnblockModal'
  );
  // click on the unblock button
  await alice.clickOnWithText(Global.confirmButton, tStripped('blockUnblock'));
  // make sure no blocked contacts are listed
  await alice.waitForMatchingText(tStripped('blockBlockedNone'), 1_000);
});

test_Alice_1W_no_network('Change username', async ({ alice }) => {
  const newUsername = 'Tiny bubble';
  // Open Profile
  await alice.clickOn(LeftPane.profileButton);
  // Click on current username to open edit field
  await alice.clickOn(Settings.displayName);
  // Type in new username
  await alice.pasteIntoInput(Settings.displayNameInput.selector, newUsername);
  await alice.clickOnMatchingText(saveString);
  await sleepFor(1000);
  // verify name change
  expect(await alice.getPage().innerText(`[data-testid="${Settings.displayName.selector}"]`)).toBe(
    newUsername
  );
  // Exit profile modal
  await alice.clickOn(Global.modalCloseButton);
});

test_Alice_1W_no_network('Add avatar', async ({ alice }, testInfo) => {
  await alice.clickOn(LeftPane.profileButton);
  await alice.clickOn(Settings.displayName);
  await alice.clickOn(Settings.imageUploadSection);
  await alice.clickOn(Settings.imageUploadClick);
  await sleepFor(500);
  await alice.clickOn(Settings.saveProfileUpdateButton);
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  // Cancel button should not be visible if you added an avatar
  await expect(alice.getPage().getByRole('button').filter({ hasText: cancelString })).toBeHidden();
  await alice.clickOnMatchingText(saveString);
  await alice.clickOn(Global.modalCloseButton);
  await sleepFor(500);
  const leftpaneAvatarContainer = await waitForTestIdWithText(
    alice.getPage(),
    LeftPane.profileButton.selector
  );
  await compareElementScreenshot({
    element: leftpaneAvatarContainer,
    snapshotName: 'avatar-updated-blue.jpeg',
    testInfo,
    maxRetryDurationMs: 4_000,
  });
});

test_Alice_1W_no_network('Remove avatar', async ({ alice }) => {
  await alice.clickOn(LeftPane.profileButton);
  await alice.clickOn(Settings.displayName);
  await alice.clickOn(Settings.imageUploadSection);
  await alice.clickOn(Settings.imageUploadClick);
  await sleepFor(500);
  await alice.clickOn(Settings.saveProfileUpdateButton);
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  await alice.clickOnMatchingText(saveString);
  await alice.clickOn(Global.modalCloseButton);
  await sleepFor(500);
  // Verify that an img is present (avatar upload succeeded) but don't do full image comparison
  await expect(
    alice.getPage().getByTestId(LeftPane.profileButton.selector).locator('img')
  ).toBeVisible();
  await alice.clickOn(LeftPane.profileButton);
  await alice.clickOn(Settings.displayName);
  await alice.clickOn(Settings.imageUploadSection);
  await alice.getPage().getByText(removeString).click();
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  // Cancel button should not be visible if you remove your avatar
  await expect(alice.getPage().getByRole('button').filter({ hasText: cancelString })).toBeHidden();
  await alice.clickOnMatchingText(saveString);
  // If removing was successful, show no img but show Alice's initials instead
  await expect(
    alice.getPage().getByTestId(Settings.profilePicture.selector).locator('img')
  ).toBeHidden();
  await expect(
    alice.getPage().getByTestId(Settings.profilePicture.selector).filter({ hasText: 'AL' })
  ).toBeVisible();
});

test_Alice_1W_Bob_1W('Set nickname', async ({ alice, bob }) => {
  const nickname = 'new nickname for Bob';

  await alice.createContactWith(bob);
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, bob.userName);
  await alice.clickOnMatchingText(tStripped('nicknameSet'));
  await sleepFor(1000);

  await alice.pasteIntoInput('nickname-input', nickname);
  await sleepFor(100);
  await alice.clickOnWithText(HomeScreen.setNicknameButton, saveString);
  await sleepFor(1000);

  const headerUsername = await waitForTestIdWithText(alice.getPage(), 'header-conversation-name');
  const headerUsernameText = await headerUsername.innerText();
  console.info('Innertext ', headerUsernameText);

  expect(headerUsernameText).toBe(nickname);
  // Check conversation list name also
  const conversationListUsernameText = await waitForTestIdWithText(
    alice.getPage(),
    'module-conversation__user__profile-name'
  );
  const conversationListUsername = await conversationListUsernameText.innerText();
  expect(conversationListUsername).toBe(nickname);
});

test_Alice_1W_Bob_1W('Read status', async ({ alice, bob }) => {
  await alice.createContactWith(bob);
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: LeftPane.settingsButton.selector,
  });
  await alice.clickOn(Settings.privacyMenuItem);
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: Settings.enableReadReceipts.selector,
  });
  await alice.clickOn(Global.modalCloseButton);
  await alice.openConversationWith(bob.userName);

  await bob.clickOnElement({
    strategy: 'data-testid',
    selector: LeftPane.settingsButton.selector,
  });
  await bob.clickOn(Settings.privacyMenuItem);

  await bob.clickOnElement({
    strategy: 'data-testid',
    selector: Settings.enableReadReceipts.selector,
  });
  await bob.clickOn(Global.modalCloseButton);
  await alice.sendMessage('Testing read receipts');
  await bob.openConversationWith(alice.userName);
  await alice.waitForMessageStatus('Testing read receipts', 'read');
});

test_Alice_1W_Bob_1W('Delete conversation', async ({ alice, bob }) => {
  // Create contact and send new message
  await alice.createContactWith(bob);
  await Promise.all(
    [alice, bob].map(w =>
      w.clickOnElement({
        strategy: 'data-testid',
        selector: 'new-conversation-button',
      })
    )
  );
  await Promise.all([
    alice.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
    bob.waitForTestIdWithText(Global.contactItem.selector, alice.userName),
  ]);

  await Promise.all([alice, bob].map(w => w.clickOn(Global.backButton)));

  // Delete contact
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, bob.userName);
  await alice.clickOnWithText(Global.contextMenuItem, tStripped('conversationsDelete'));
  await alice.checkModalStrings(
    tStripped('conversationsDelete'),
    tStripped('deleteConversationDescription', { name: bob.userName })
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('delete'));
  // Check if conversation is deleted
  await hasElementBeenDeleted(alice.getPage(), Global.contactItem, {
    maxWait: 1000,
    text: bob.userName,
  });
});

test_Alice_2W('Hide recovery password', async ({ alice, alice2 }) => {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  await alice.clickOn(Settings.hideRecoveryPasswordButton);
  // Check first modal
  await alice.checkModalStrings(
    tStripped('recoveryPasswordHidePermanently'),
    tStripped('recoveryPasswordHidePermanentlyDescription1'),
    'hideRecoveryPasswordModal'
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('theContinue'));
  await alice.checkModalStrings(
    tStripped('recoveryPasswordHidePermanently'),
    tStripped('recoveryPasswordHidePermanentlyDescription2'),
    'hideRecoveryPasswordModal'
  );
  // Click yes
  await alice.clickOnWithText(Global.confirmButton, tStripped('yes'));
  await doesElementExist(alice.getPage(), Settings.recoveryPasswordMenuItem);
  // Check linked device if Recovery Password is still visible (it should be)
  await alice2.clickOn(LeftPane.settingsButton);
  await alice2.waitForTestIdWithText(Settings.recoveryPasswordMenuItem.selector);
});

test_Alice_1W_no_network('Invite a friend', async ({ alice }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.inviteAFriendOption);
  await alice.waitForTestIdWithText('your-account-id', alice.accountId);
  await alice.clickOn(HomeScreen.inviteAFriendCopyButton);
  // Toast
  await alice.waitForTestIdWithText(Global.toast.selector, tStripped('copied'));
  // Wait for copy to resolve
  await sleepFor(1000);
  await alice.waitForMatchingText(tStripped('accountIdCopied'), 1_000);
  await alice.waitForMatchingText(tStripped('shareAccountIdDescriptionCopied'), 1_000);
  // To exit invite a friend
  await alice.clickOn(Global.backButton);
  // New message
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.clickOn(HomeScreen.newMessageAccountIDInput);

  await alice.getPage().keyboard.press(`${controlOrMetaFor()}+V`);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  // Did the copied text create note to self?
  await alice.waitForTestIdWithText(
    Conversation.conversationHeader.selector,
    tStripped('noteToSelf')
  );
});

test_Alice_1W_no_network('Hide note to self', async ({ alice }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.pasteIntoInput('new-session-conversation', alice.accountId);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  await alice.waitForTestIdWithText(
    Conversation.conversationHeader.selector,
    tStripped('noteToSelf')
  );
  await alice.rightClickOnWithText(HomeScreen.conversationItemName, tStripped('noteToSelf'));
  await alice.clickOnWithText(Global.contextMenuItem, tStripped('noteToSelfHide'));
  await alice.checkModalStrings(
    tStripped('noteToSelfHide'),
    tStripped('noteToSelfHideDescription')
  );
  await alice.clickOnWithText(Global.confirmButton, tStripped('hide'));
  await hasElementBeenDeleted(alice.getPage(), HomeScreen.conversationItemName, {
    maxWait: 5000,
    text: tStripped('noteToSelf'),
  });
});

test_Alice_1W_no_network('Toggle password', async ({ alice }) => {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.recoveryPasswordMenuItem);
  await alice.waitForTestIdWithText(Settings.recoveryPasswordContainer.selector);
  await alice.clickOnMatchingText(tStripped('qrView'));
  // Wait for QR code to be visible
  await alice.waitForTestIdWithText(Settings.recoveryPasswordQRCode.selector);
  // Then toggle back to text seed password
  await alice.clickOnMatchingText(tStripped('recoveryPasswordView'));
  await alice.waitForTestIdWithText(Settings.recoveryPasswordContainer.selector);
});

test_Alice_2W('Consistent avatar colours', async ({ alice, alice2 }) => {
  const avatarColors = await Promise.all(
    [alice, alice2].map(w =>
      w
        .getPage()
        .locator('[data-testid="leftpane-primary-avatar"] > svg > g > circle')
        .getAttribute('fill')
    )
  );

  console.log('avatar1Color', avatarColors[0]);
  console.log('avatar2Color', avatarColors[1]);

  if (avatarColors[0] !== avatarColors[1]) {
    throw new Error('Avatar colours are not consistent');
  }
});
