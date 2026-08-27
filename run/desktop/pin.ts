import type { DesktopWrapper } from './DesktopWrapper';

import { getCommunities } from '../constants/community';
import { joinCommunityByLink } from './join_community';
import { Global, HomeScreen } from './locators';

/**
 * Pinning, and the conversations to pin, for the specs that exercise the pinned-conversation limit.
 *
 * Shared rather than local to one spec because the limit is asserted from two directions — the standard
 * and Pro boundaries, and the state where the plan is active but unprovable — and those must pin the
 * same rooms in the same way for their results to be comparable.
 */

/** The pin marker on one conversation's row. Unscoped it matches whichever row happens to be pinned. */
export function pinIconFor(window: DesktopWrapper, conversationName: string) {
  return window
    .getPage()
    .locator(`css=.${HomeScreen.conversationItemHeader.selector}`)
    .filter({ hasText: conversationName })
    .locator(`[data-testid="${HomeScreen.pinnedConversationIcon.selector}"]`);
}

/** Attempts before giving up. One retry covers a lost right-click; more would hide a real fault. */
const PIN_ATTEMPTS = 2;

/**
 * Right-click a conversation and choose Pin. Dispatches the action and does NOT check the outcome.
 *
 * Use this only where a refusal is a legitimate result — the over-limit call sites, which assert the pin
 * does not appear. Where a pin is expected to succeed, use `pinConversationConfirmed`.
 *
 * ⚠️ A separate hazard, deliberately left alone: the pin and unpin labels share the `context-menu-item`
 * testid (`ConversationListItemContextMenu.tsx`, `isPinned ? 'pinUnpin' : 'pin'`), and the shared click
 * helper matches with `:has-text` — a case-insensitive SUBSTRING, so "Pin" also matches "Unpin". Nothing
 * here pins an already-pinned conversation, so it does not bite today. An exact `:text-is` match is NOT
 * the fix: measured, it matches nothing, because the item's text is not exactly the pin label. Anything
 * that needs to unpin must not reuse this.
 */
export async function pinConversation(window: DesktopWrapper, conversationName: string) {
  const menuItems = window
    .getPage()
    .locator(`[${Global.contextMenuItem.strategy}=${Global.contextMenuItem.selector}]`);

  // The previous conversation's menu has to be gone before this right-click, or the click is swallowed
  // by the closing menu and no new menu opens. Resolves immediately when no menu is up.
  await menuItems.first().waitFor({ state: 'detached' });
  await window.rightClickOnWithText(HomeScreen.conversationItemName, conversationName);
  await window.clickOn(Global.pinConversationMenuItem);
}

/**
 * Pin a conversation and return only once it is pinned, retrying once if it is not.
 *
 * The clicks alone are not sufficient. Both dispatch successfully while nothing gets pinned, at a measured
 * 10-27% on an untouched tree — and it is never the first pin, because the failure needs a previous menu
 * to still be closing. A caller that merely waits longer is asserting the pin appeared slowly, which is
 * not what happens: it never appears at all.
 */
export async function pinConversationConfirmed(window: DesktopWrapper, conversationName: string) {
  for (let attempt = 1; attempt <= PIN_ATTEMPTS; attempt++) {
    await pinConversation(window, conversationName);
    try {
      await pinIconFor(window, conversationName).waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch {
      // Logged rather than swallowed: the retry masks a race in the app's context menu, so a run that
      // needed it should say so instead of looking clean.
      console.info(
        `pinConversationConfirmed: "${conversationName}" not pinned on attempt ${attempt}`
      );
      if (attempt === PIN_ATTEMPTS) {
        throw new Error(
          `Failed to pin "${conversationName}" after ${PIN_ATTEMPTS} attempts: the clicks dispatched and ` +
            `no pin icon appeared.`
        );
      }
    }
  }
}

export async function joinCommunities(
  window: DesktopWrapper,
  count: number
): Promise<Array<string>> {
  const communities = Object.values(getCommunities()).slice(0, count);
  if (communities.length < count) {
    throw new Error(`Need ${count} communities to test the pin limit, got ${communities.length}`);
  }
  for (const community of communities) {
    await joinCommunityByLink(window.getPage(), community.link, community.name);
  }
  return communities.map(community => community.name);
}
