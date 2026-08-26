import { test } from '@playwright/test';

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { getCommunities } from '../../../constants/community';
import { breakTheRun } from '../../../desktop/message';
import { test_Alice_1W_Bob_1W, test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { perTestRoomsEnabled } from '../../utils/community_rooms';

/**
 * Two Desktop windows: a Pro subscriber posts to a community and the other member renders her badge
 * on the message author label. Distinct from the group spec because a community message arrives
 * through SOGS from a BLINDED sender, so the proof is verified and stored on a different path.
 *
 * Traps:
 * - Needs a REAL grant. The Pro mocks are display-level and per-device, so they produce no proof for
 *   the recipient to verify, which is the whole claim.
 * - The badge comes from the sender's PROFILE, not the message. So the control has to be taken before
 *   the grant — afterwards, Alice's earlier message renders a badge too.
 * - Registered twice, for strangers and for existing contacts. Desktop stores a community sender's
 *   Pro details against `getCachedNakedKeyFromBlindedNoServerPubkey(...) ?? blinded`
 *   (`ts/receiver/opengroup.ts:111`) while the author label reads the blinded id (`:97`), so a
 *   CACHED naked key would put the details where the label never looks. Both variants pass, because
 *   being contacts does not populate that cache — only an actual blinded-id resolution does.
 *
 * Skips without a per-test room. Not for attribution — this assertion is scoped to one message's
 * author label — but so both halves of the claim run under the same conditions: the mobile half
 * cannot run without a local SOGS, and the alternative posts real test traffic to a shared community.
 */

async function communityAuthorProBadge(alice: DesktopWrapper, bob: DesktopWrapper) {
  if (!perTestRoomsEnabled()) {
    test.skip(
      true,
      'Needs a community room this test created, for parity with the mobile half of this claim — ' +
        'see the note above. Set COMMUNITY_LINK and SOGS_ADMIN_SEED to a local SOGS, the same stack ' +
        'this spec already needs for the Pro backend.'
    );
  }

  const community = getCommunities().testCommunity;
  // Unique per run: against the shared community two runs would otherwise post the same text, and
  // the assertions scope by message body, so a second match is a strict-mode failure rather than a
  // wrong answer.
  const signature = `${Date.now()}`;
  const messageBefore = `Sending this one before I subscribe - ${signature}`;
  const messageAfter = `Sending this one as a subscriber - ${signature}`;
  const bobBreaker = `Bob speaking up so Alice starts a new run - ${signature}`;

  await Promise.all(
    [alice, bob].map(window => window.joinCommunityByLink(community.link, community.name))
  );
  await Promise.all([alice, bob].map(window => window.scrollToBottomIfNecessary()));

  // The control, and the reason the last step means anything: the same locator on the same screen,
  // before Alice has anything to show. It asserts her author label is rendered AND carries no badge,
  // so it cannot be satisfied by a label that is simply missing. Alice's message is the first of her
  // run here without any help — the room's previous message is somebody else's.
  await alice.sendMessage(messageBefore);
  await bob.waitForMessage(messageBefore, MESSAGE_DELIVERY_TIMEOUT_MS);
  await bob.assertNoMessageAuthorProBadge(messageBefore);

  await alice.subscribeToPro();
  // A restart does not surface a grant this client has never seen — the cold-launch fetch is gated on
  // already knowing there is access. Opening Pro settings fetches regardless, which is what this does.
  await alice.waitForProActive();
  // Being Pro and advertising it are separate: the badge bit rides in Alice's profile, so without this
  // her proof arrives with nothing asking Bob to draw anything.
  await alice.enableProBadge();
  // The Pro settings navigation left Alice on the home screen, not in the community.
  await alice.openConversationWith(community.name);
  await alice.scrollToBottomIfNecessary();

  await breakTheRun(bob, [alice], bobBreaker);
  await alice.sendMessage(messageAfter);
  await bob.waitForMessage(messageAfter, MESSAGE_DELIVERY_TIMEOUT_MS);
  await bob.assertMessageAuthorProBadge(messageAfter);
}

test_Alice_1W_Bob_1W(
  'Pro badge shows on a community message author',
  async ({ alice, bob }) => communityAuthorProBadge(alice, bob),
  { communityRooms: 1, pro: {} }
);

/** Guards the cached-naked-key path described above. Passes today; see that note for why. */
test_Alice_1W_Bob_1W_friends(
  'Pro badge shows on a community message author from a known contact',
  async ({ alice, bob }) => communityAuthorProBadge(alice, bob),
  { communityRooms: 1, pro: {} }
);
