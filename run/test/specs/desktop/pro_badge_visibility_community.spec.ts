import { test } from '@playwright/test';

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { getCommunities } from '../../../constants/community';
import { breakTheRun } from '../../../desktop/message';
import { test_Alice_1W_Bob_1W, test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { perTestRoomsEnabled } from '../../utils/community_rooms';

/**
 * Same-platform: two Desktop windows, no mobile client involved. The community counterpart of
 * `pro_badge_visibility_group.spec.ts`, and the Desktop counterpart of the mobile
 * `pro_badge_visibility_community` spec.
 *
 * It is a distinct claim rather than a re-run of the group one. A community message reaches the
 * recipient through SOGS, from a BLINDED sender, so the sender's own account key is not on the message
 * at all. Everything the group spec relies on — the sender's profile arriving over the swarm, the
 * proof being checked against a contact record keyed by their Account ID — is a different mechanism
 * here, and the badge is the visible end of it.
 *
 * A community message can carry a verifiable proof, which is the first thing to establish since the
 * spec is worthless otherwise. Desktop decodes community payloads through a dedicated entry point that
 * takes the Pro backend key — `MultiEncryptWrapperActions.decryptForCommunity(…, proBackendPubkeyHex)`
 * in `ts/session/apis/open_group_api/sogsv3/sogsApiV3.ts` — and keeps the result only if the signature
 * verified (`BaseDecodedEnvelope`'s `validPro`). Blinding is not an obstacle because the proof is
 * signed by the BACKEND over a rotating Pro key rather than bound to the sender's Account ID, so there
 * is nothing in it for SOGS's blinding to invalidate.
 *
 * Desktop then writes the decoded features onto the sender's own conversation record —
 * `ts/receiver/opengroup.ts` builds a private profile change carrying `bitsetProFeatures`,
 * `proExpiryTsMs` and `proRevocationTagB64` — and that record is keyed by the BLINDED id for a sender
 * we have never resolved. `Conversation.showProBadgeFor` reads exactly it, and admits a blinded
 * acquaintance as a first-class holder of Pro details, so the author label has something to render.
 *
 * A REAL grant, not `DesktopProContext`, for the same reason as the group spec: the mocks are
 * display-level and per-device, so they persuade Alice's own client that she is Pro and produce no
 * proof for anyone else to verify. The whole claim here is that Bob verified one — over a transport
 * where he cannot even see who Alice is.
 *
 * The badge is driven by the SENDER'S PROFILE, not by the message it arrives with, so the control has
 * to be taken before the grant rather than by comparing two messages afterwards: once Alice's record
 * on Bob carries the proof, her earlier message renders the badge too.
 *
 * ### Alice and Bob must NOT be contacts, and this is load-bearing
 *
 * Desktop rewrites a community message's sender from the blinded id to the real one only when the
 * sender is US (`sogsApiV3.ts`), but writes the sender's profile to
 * `getCachedNakedKeyFromBlindedNoServerPubkey(...) ?? blinded` — the real id whenever we already know
 * it. For a recipient who has resolved the sender before, the Pro details therefore land on the naked
 * record while the author label still reads the blinded one, and no badge appears. So this uses the
 * unseeded `test_Alice_1W_Bob_1W`, where the two accounts have never exchanged anything: swapping in
 * the `_friends` fixture would make the assertion fail for a reason that has nothing to do with Pro.
 *
 * ### Why this requires a per-test room, as the mobile spec does
 *
 * Not for attribution: unlike mobile — whose `pro-badge-icon` is structural and matches any badge on
 * screen — this assertion is scoped to one message's author label, so a badge it finds is Alice's by
 * construction and a shared room would prove the same thing.
 *
 * It skips anyway, to hold BOTH halves of one claim to the same conditions. The mobile half already
 * cannot run without a local SOGS, so letting the Desktop half fall back to the shared production
 * community means a green pair that was never actually compared: two different rooms, two different
 * sets of other posters, and real test traffic posted to a community other people use. The stack that
 * serves the local SOGS is the same one the real Pro grant already requires.
 *
 * What would fail this: dropping the badge from the author label in a community, or accepting Alice's
 * proof off a community message without verifying it, fails the final step. Rendering the badge for
 * every author regardless of proof — the failure mode an assertion with no control cannot see — fails
 * the control instead.
 */
/**
 * The claim, run against two different starting states.
 *
 * Parameterised because the interesting variable is whether the recipient has ALREADY resolved the
 * sender's blinded id to their real one — see the contact note above. Everything else is identical,
 * so any difference in outcome is attributable to that and nothing else.
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
  // `pro` tags the test `@pro`; the state itself comes from the grant above, not from a mock.
  { communityRooms: 1, pro: {} }
);

/**
 * The same claim between two accounts that ARE already contacts.
 *
 * Expected to FAIL on Desktop today, and that is the point: it pins the divergence described above.
 * Desktop writes a community sender's Pro details to
 * `getCachedNakedKeyFromBlindedNoServerPubkey(...) ?? blinded` — the naked id whenever the recipient
 * already knows it — while the message's author label still reads the blinded one, so the badge has
 * nowhere to render from. Android passes the sender address through unmodified
 * (`VisibleMessageHandler.kt`), so the mobile counterpart of this test is expected to pass.
 *
 * Asserting the correct behaviour rather than the current one is deliberate. Skipping it, or
 * inverting it to expect no badge, would document the bug as intended and outlive everyone’s memory
 * of why.
 */
test_Alice_1W_Bob_1W_friends(
  'Pro badge shows on a community message author from a known contact',
  async ({ alice, bob }) => communityAuthorProBadge(alice, bob),
  { communityRooms: 1, pro: {} }
);
