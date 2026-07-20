// @ported-from tests/automation/community_tests.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { expect } from '@playwright/test';

import { testCommunityName } from '../../../desktop/constants/community';
import { Global, HomeScreen, LeftPane, Settings } from '../../../desktop/locators';
import { test_Alice_1W_Bob_1W, test_Alice_2W } from '../../../desktop/sessionTest';
import { grabTextFromElement } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

test_Alice_2W('Join community and sync', async ({ alice, alice2 }) => {
  await alice.joinCommunity();
  await alice.scrollToBottomIfNecessary();
  await alice.sendMessage('Hello, community!');
  // Check linked device for community

  await alice2.openConversationWith(testCommunityName);
});

test_Alice_1W_Bob_1W('Send image to community', async ({ alice, bob }) => {
  const mediaPath = 'sample_files/test-image.png';
  const testImageMessage = `Image message + ${Date.now()} + desktop`;
  const testReply = `${bob.userName} replying to image from ${alice.userName}`;
  await Promise.all([alice.joinCommunity(), bob.joinCommunity()]);
  // await Promise.all([
  //   waitForLoadingAnimationToFinish(aliceWindow1, 'loading-spinner'),
  //   waitForLoadingAnimationToFinish(bobWindow1, 'loading-spinner'),
  // ]);
  await Promise.all([alice, bob].map(window => window.scrollToBottomIfNecessary()));
  await alice.sendMedia(mediaPath, testImageMessage, true);
  await bob.replyTo({
    textMessage: testImageMessage,
    replyText: testReply,
    to: alice,
    shouldCheckMediaPreview: true,
  });
});

test_Alice_1W_Bob_1W('Community message requests on', async ({ alice, bob }) => {
  await bob.clickOn(LeftPane.settingsButton);
  await bob.clickOn(Settings.privacyMenuItem);
  await bob.clickOn(Settings.enableCommunityMessageRequests);
  await bob.clickOn(Global.modalCloseButton);
  await Promise.all([alice.joinCommunity(), bob.joinCommunity()]);
  const communityMsg = `I accept message requests + ${Date.now()}`;
  await bob.sendMessage(communityMsg);
  await alice.scrollToBottomIfNecessary();
  // Using native methods to locate the author corresponding to the sent message
  await alice
    .getPage()
    .locator('.module-message__container', { hasText: communityMsg })
    .locator('..') // Go up to parent
    .locator('svg')
    .click();
  const elText = await grabTextFromElement(alice.getPage(), 'data-testid', 'account-id');
  expect(elText).toMatch(/^15/);
  await alice.clickOn(HomeScreen.newMessageAccountIDInput); // yes this is the actual locator for the 'Message' button
  await alice.waitForTestIdWithText('header-conversation-name', bob.userName);
  const messageRequestMsg = `${alice.userName} to ${bob.userName}`;
  const messageRequestResponse = `${bob.userName} accepts message request`;
  await alice.sendMessage(messageRequestMsg);
  await bob.clickOn(HomeScreen.messageRequestBanner);
  // Select message request from User A
  await bob.openConversationWith(alice.userName);
  await bob.sendMessage(messageRequestResponse);
  // Check config message of message request acceptance
  await bob.waitForTestIdWithText(
    'message-request-response-message',
    tStripped('messageRequestYouHaveAccepted', {
      name: alice.userName,
    })
  );
});
test_Alice_1W_Bob_1W('Community message requests off', async ({ alice, bob }) => {
  await Promise.all([alice.joinCommunity(), bob.joinCommunity()]);
  const communityMsg = `I do not accept message requests + ${Date.now()}`;
  await bob.sendMessage(communityMsg);
  await alice.scrollToBottomIfNecessary();
  // Using native methods to locate the author corresponding to the sent message
  await alice
    .getPage()
    .locator('.module-message__container', { hasText: communityMsg })
    .locator('..') // Go up to parent
    .locator('svg')
    .click();
  const elText = await grabTextFromElement(alice.getPage(), 'data-testid', 'account-id');
  expect(elText).toMatch(/^15/);
  const messageButton = alice.getPage().getByTestId(HomeScreen.newMessageAccountIDInput.selector);
  await expect(messageButton).toHaveClass(/disabled/);
});
