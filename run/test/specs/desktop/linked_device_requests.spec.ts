// @ported-from tests/automation/linked_device_requests.spec.ts
// @port-kind   spec

import { Conversation, Global, HomeScreen, LeftPane, Settings } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { test_Alice_2W_Bob_1W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

test_Alice_2W_Bob_1W('Accept request syncs', async ({ alice, alice2, bob }) => {
  const testMessage = `${bob.userName} sending message request to ${alice.userName}`;
  const testReply = `${alice.userName} accepting message request from ${bob.userName}`;
  await bob.sendNewMessage(alice.accountId, testMessage);
  // Accept request in aliceWindow1
  await alice.clickOn(HomeScreen.messageRequestBanner);
  await alice2.clickOn(HomeScreen.messageRequestBanner);
  await alice.openConversationWith(bob.userName);

  await alice.clickOn(Conversation.acceptMessageRequestButton);
  await alice.waitForTestIdWithText(
    Conversation.messageRequestAcceptControlMessage.selector,
    tStripped('messageRequestYouHaveAccepted', {
      name: bob.userName,
    })
  );
  await alice.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
  await alice2.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
  await alice.sendMessage(testReply);
  await bob.waitForTextMessage(testReply);
  await alice2.clickOn(Global.backButton);
  await alice2.clickOn(HomeScreen.plusButton);
  await alice2.waitForTestIdWithText(Global.contactItem.selector, bob.userName);
});

test_Alice_2W_Bob_1W('Decline request syncs', async ({ alice, alice2, bob }) => {
  const testMessage = `${bob.userName} sending message request to ${alice.userName}`;
  await bob.sendNewMessage(alice.accountId, testMessage);
  // Decline request in aliceWindow1
  await alice.clickOn(HomeScreen.messageRequestBanner);
  await alice.openConversationWith(bob.userName);

  await alice2.clickOn(HomeScreen.messageRequestBanner);
  await alice2.waitForTestIdWithText(HomeScreen.conversationItemName.selector, bob.userName);
  await sleepFor(1000);
  await alice.clickOnWithText(Conversation.deleteMessageRequestButton, tStripped('delete'));
  await alice.clickOnWithText(Global.confirmButton, tStripped('delete'));

  await Promise.all(
    [alice, alice2].map(w => w.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000))
  );
});

test_Alice_2W_Bob_1W('Message requests block', async ({ alice, alice2, bob }) => {
  const testMessage = `Sender: ${bob.userName}, Receiver: ${alice.userName}`;
  // send a message to Bob to Alice
  await bob.sendNewMessage(alice.accountId, `${testMessage}`);
  // Check the message request banner appears and click on it
  await alice.clickOn(HomeScreen.messageRequestBanner);
  // Select message request from Bob
  await alice.openConversationWith(bob.userName);
  // Block Bob
  await alice.clickOn(Conversation.blockMessageRequestButton);
  // Check modal strings
  await alice.checkModalStrings(
    tStripped('block'),
    tStripped('blockDescription', { name: bob.userName })
  );
  // Confirm block
  await alice.clickOn(Global.confirmButton);
  // Need to wait for the blocked status to sync
  await sleepFor(2000);
  // Check blocked status in blocked contacts list
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.conversationsMenuItem);
  await alice.clickOn(Settings.blockedContactsButton);
  await alice.waitForTestIdWithText(Global.contactItem.selector, bob.userName);
  // Check that the blocked contacts is on aliceWindow2
  // Check blocked status in blocked contacts list
  await alice2.clickOn(LeftPane.settingsButton);
  await alice2.clickOn(Settings.conversationsMenuItem);
  // the blocked conversation list UI does not refresh automatically
  // so we need to refresh it manually
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await alice2.clickOn(Settings.blockedContactsButton);
      await alice2.waitForMatchingText(bob.userName, 1_000);
      break;
    } catch (e) {
      console.info(`failed to find blocked contact "${bob.userName}", attempt: ${i}`);
      if (i === maxAttempts - 1) {
        throw e;
      }
      await sleepFor(1000);
      await alice2.clickOn(Global.modalBackButton);
    }
  }
});
