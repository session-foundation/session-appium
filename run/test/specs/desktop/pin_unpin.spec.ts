// @ported-from tests/automation/pin_unpin.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Global, HomeScreen } from '../../../desktop/locators';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { assertPinOrder, getConversationOrder } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

async function pinConversation(window: DesktopWrapper, conversationName: string) {
  await window.rightClickOnWithText(HomeScreen.conversationItemName, conversationName);
  await window.clickOnWithText(Global.contextMenuItem, tStripped('pin'));
}

async function unpinConversation(window: DesktopWrapper, conversationName: string) {
  await window.rightClickOnWithText(HomeScreen.conversationItemName, conversationName);
  await window.clickOnWithText(Global.contextMenuItem, tStripped('pinUnpin'));
}

test_Alice_1W('Pin and unpin a conversation', async ({ alice }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.pasteIntoInput(HomeScreen.newMessageAccountIDInput.selector, alice.accountId);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  await alice.waitForTestIdWithText('header-conversation-name', tStripped('noteToSelf'));
  await alice.sendMessage('Buy milk');
  await alice.joinCommunity();

  const beforeOrder = await getConversationOrder(alice.getPage());
  const lastConversation = beforeOrder[beforeOrder.length - 1];
  console.log('Order before pinning:', beforeOrder);
  console.log('Pinning:', lastConversation);

  const pinIcon = alice
    .getPage()
    .locator(`css=.${HomeScreen.conversationItemHeader.selector}`)
    .filter({ hasText: lastConversation })
    .locator(`[data-testid="${HomeScreen.pinnedConversationIcon.selector}"]`);

  await pinConversation(alice, lastConversation);
  await pinIcon.waitFor({ state: 'visible' });
  const afterPinOrder = await getConversationOrder(alice.getPage());
  console.log('Order after pinning:', afterPinOrder);
  assertPinOrder(beforeOrder, [lastConversation], afterPinOrder);

  await unpinConversation(alice, lastConversation);
  await pinIcon.waitFor({ state: 'hidden' });
  const afterUnpinOrder = await getConversationOrder(alice.getPage());
  console.log('Order after unpinning:', afterUnpinOrder);
  assertPinOrder(beforeOrder, [], afterUnpinOrder);
});
