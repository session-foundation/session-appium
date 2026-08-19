import type { DesktopWrapper } from './DesktopWrapper';

import { getCommunities } from '../constants/community';
import { tStripped } from '../localizer/lib';
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

export async function pinConversation(window: DesktopWrapper, conversationName: string) {
  await window.rightClickOnWithText(HomeScreen.conversationItemName, conversationName);
  await window.clickOnWithText(Global.contextMenuItem, tStripped('pin'));
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
