import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { getCommunities } from '../../../constants/community';
import { joinCommunityByLink } from '../../../desktop/join_community';
import { CTA, Global, HomeScreen } from '../../../desktop/locators';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

/**
 * The pinned-conversation limit either side of the Pro boundary: five for a standard user, more for a
 * subscriber.
 *
 * Communities rather than contacts because they populate the conversation list without another party
 * replying, and taking the set from the shared `getCommunities()` means both platforms pin the same
 * rooms.
 *
 * Both specs assert the **pin icon**, not just the absence of a CTA: a limit that refused every pin,
 * or that showed the CTA and pinned anyway, satisfies a CTA-only assertion.
 */

const COMMUNITY_COUNT = 6;
const STANDARD_PIN_LIMIT = 5;

/** The pin marker on one conversation's row. Unscoped it matches whichever row happens to be pinned. */
function pinIconFor(window: DesktopWrapper, conversationName: string) {
  return window
    .getPage()
    .locator(`css=.${HomeScreen.conversationItemHeader.selector}`)
    .filter({ hasText: conversationName })
    .locator(`[data-testid="${HomeScreen.pinnedConversationIcon.selector}"]`);
}

async function pinConversation(window: DesktopWrapper, conversationName: string) {
  await window.rightClickOnWithText(HomeScreen.conversationItemName, conversationName);
  await window.clickOnWithText(Global.contextMenuItem, tStripped('pin'));
}

async function joinCommunities(window: DesktopWrapper, count: number): Promise<Array<string>> {
  const communities = Object.values(getCommunities()).slice(0, count);
  if (communities.length < count) {
    throw new Error(`Need ${count} communities to test the pin limit, got ${communities.length}`);
  }
  for (const community of communities) {
    await joinCommunityByLink(window.getPage(), community.link, community.name);
  }
  return communities.map(community => community.name);
}

test_Alice_1W(
  'Pinned conversation limit (non Pro)',
  async ({ alice }) => {
    const names = await joinCommunities(alice, COMMUNITY_COUNT);

    for (const name of names.slice(0, STANDARD_PIN_LIMIT)) {
      await pinConversation(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    const overLimit = names[STANDARD_PIN_LIMIT];
    await pinConversation(alice, overLimit);
    await alice.checkCTA('pinnedConversations');
    await alice.clickOn(CTA.cancelButton);

    // The CTA appearing is not the same as the pin being refused.
    await pinIconFor(alice, overLimit).waitFor({ state: 'hidden' });
  },
  { pro: { proBackendStatus: 'never' }, communityRooms: COMMUNITY_COUNT }
);

test_Alice_1W(
  'Pinned conversation limit (Pro)',
  async ({ alice }) => {
    const names = await joinCommunities(alice, COMMUNITY_COUNT);

    for (const name of names) {
      await pinConversation(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);
  },
  {
    pro: { proBackendStatus: 'active', proAccessExpiry: 'P30D' },
    communityRooms: COMMUNITY_COUNT,
  }
);
