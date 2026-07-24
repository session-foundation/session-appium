// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { Conversation, Global, HomeScreen, LeftPane, Settings } from '../../../desktop/locators';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

// Open two windows and log into 2 separate accounts
test_Alice_1W_Bob_1W('Message requests accept', async ({ alice, bob }) => {
  const testMessage = `Sender: ${alice.userName} Receiver: ${bob.userName}`;
  // send a message to User B from User A
  await alice.sendNewMessage(bob.accountId, `${testMessage}`);
  // Check the message request banner appears and click on it
  await bob.clickOn(HomeScreen.messageRequestBanner);
  // Select message request from User A
  await bob.openConversationWith(alice.userName);
  // Check that using the accept button has intended use
  await bob.clickOn(Conversation.acceptMessageRequestButton);
  // Check config message of message request acceptance
  await bob.waitForTestIdWithText(
    'message-request-response-message',
    tStripped('messageRequestYouHaveAccepted', {
      name: alice.userName,
    })
  );
  await bob.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
});

test_Alice_1W_Bob_1W('Message requests text reply', async ({ alice, bob }) => {
  const testMessage = `Sender: ${alice.userName}, Receiver: ${bob.userName}`;
  const testReply = `Sender: ${bob.userName}, Receiver: ${alice.userName}`;
  // send a message to User B from User A
  await alice.sendNewMessage(bob.accountId, `${testMessage}`);
  // Check the message request banner appears and click on it
  await bob.clickOn(HomeScreen.messageRequestBanner);
  // Select message request from User A
  await bob.openConversationWith(alice.userName);

  await bob.sendMessage(testReply);
  // Check config message of message request acceptance

  await bob.waitForTestIdWithText(
    'message-request-response-message',
    tStripped('messageRequestYouHaveAccepted', {
      name: alice.userName,
    })
  );
  await bob.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
});

test_Alice_1W_Bob_1W('Message requests decline', async ({ alice, bob }) => {
  const testMessage = `Sender: ${alice.userName}, Receiver: ${bob.userName}`;
  // send a message to User B from User A
  await alice.sendNewMessage(bob.accountId, `${testMessage}`);
  // Check the message request banner appears and click on it
  await bob.clickOn(HomeScreen.messageRequestBanner);
  // Select message request from User A
  await bob.openConversationWith(alice.userName);

  await bob.clickOnWithText(Conversation.deleteMessageRequestButton, tStripped('delete'));
  // Confirm decline
  await bob.checkModalStrings(tStripped('delete'), tStripped('messageRequestsDelete'));
  await bob.clickOnWithText(Global.confirmButton, tStripped('delete'));
  // Check config message of message request acceptance
  await bob.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
});

test_Alice_1W_Bob_1W('Message requests clear all', async ({ alice, bob }) => {
  const testMessage = `Sender: ${alice.userName}, Receiver: ${bob.userName}`;
  // send a message to User B from User A
  await alice.sendNewMessage(bob.accountId, `${testMessage}`);
  // Check the message request banner appears and click on it
  await bob.clickOn(HomeScreen.messageRequestBanner);
  // Select 'Clear All' button
  await bob.clickOnMatchingText(tStripped('clearAll'));
  // Confirm decline
  await bob.checkModalStrings(
    tStripped('clearAll'),
    tStripped('messageRequestsClearAllExplanation')
  );
  await bob.clickOnWithText(Global.confirmButton, tStripped('clear'));
  // Navigate back to message request folder to check
  await bob.clickOn(LeftPane.settingsButton);

  await bob.clickOnWithText(Settings.messageRequestsMenuItem, tStripped('sessionMessageRequests'));
  // Check config message of message request acceptance
  await bob.waitForMatchingText(tStripped('messageRequestsNonePending'), 15_000);
});
