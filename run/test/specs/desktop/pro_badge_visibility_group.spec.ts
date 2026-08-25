import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { test_group_Alice_1W_Bob_1W_Charlie_1W } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';

const MESSAGE_BEFORE = 'Sending this one before I subscribe';
const MESSAGE_AFTER = 'Sending this one as a subscriber';

/**
 * Bob's two messages are structural, not conversational.
 *
 * Desktop collapses consecutive messages from one sender into a run and renders the author label on
 * the FIRST of the run only — `MessageAuthorText` is gated on `firstMessageOfSeries`, which is decided
 * purely by comparing the previous message's sender, with no time window
 * (`ts/state/selectors/conversations.ts`). The seeded group already opens with a warm-up message from
 * Alice, so with nothing of Bob's in between, neither of Alice's messages below would carry an author
 * label at all and the element this spec is about would never be rendered — in either direction.
 */
const BOB_BREAKER_ONE = 'Bob speaking up so Alice starts a new run';
const BOB_BREAKER_TWO = 'Bob speaking up again so Alice starts another run';

/**
 * Send `message` from `sender` and wait for every other window to have it.
 *
 * The wait is what makes it a run-breaker rather than a race: Alice's next message has to carry a
 * later timestamp than Bob's for the clients to order them that way, and only that ordering puts Bob's
 * message between the two of hers.
 */
async function breakTheRun(sender: DesktopWrapper, others: Array<DesktopWrapper>, message: string) {
  await sender.sendMessage(message);
  await Promise.all(
    others.map(other => other.waitForMessage(message, MESSAGE_DELIVERY_TIMEOUT_MS))
  );
}

/**
 * Same-platform: three Desktop windows, no mobile client involved. The group counterpart of
 * `pro_badge_visibility.spec.ts`.
 *
 * It asserts a different element for a real reason. A 1-to-1 renders the peer's badge in the
 * conversation HEADER and never beside a message, because the author label that carries it is
 * group-only — `MessageAuthorText` returns null unless the thread is a group. So neither spec covers
 * the other's surface, and a build that lost the badge from the group author label would still satisfy
 * the header assertion in the 1-to-1 spec.
 *
 * A REAL grant, not `DesktopProContext`. The mocks are display-level and per-device: they convince
 * Alice's own client that she is Pro and produce no proof for anyone else to verify. What Bob and
 * Charlie render here is the output of a verification — Desktop only sets `showProBadgeOthers` on
 * Alice's contact record when it holds an unexpired, unrevoked proof from her AND her profile's feature
 * bitset has `PRO_BADGE` set (`Conversation.showProBadgeFor` in `ts/models/conversation.ts`). A mock
 * reaches neither half, which is why this is one of the few Pro cases that needs the backend.
 *
 * The badge is driven by the SENDER'S PROFILE, not by the message it arrives with, so the control has
 * to be taken before the grant rather than by comparing two messages afterwards: once Alice's contact
 * record on a recipient carries the proof, her EARLIER message renders the badge too.
 *
 * Asserted on Bob and Charlie both. Each verifies Alice's proof against its own copy of her contact
 * record, so Charlie is a second independent verification rather than a repeat of Bob's.
 *
 * What would fail this: dropping the badge from the group author label, or accepting Alice's proof
 * without verifying it, fails the final step. Rendering the badge for every author regardless of proof
 * — the failure mode an assertion with no control cannot see — fails the control instead.
 */
test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Pro badge shows on a group message author',
  async ({ alice, bob, charlie, groupCreated }) => {
    const recipients = [bob, charlie];

    // The control, and the reason the last step means anything: the same locator on the same screen,
    // before Alice has anything to show. It asserts her author label is rendered AND carries no badge,
    // so it cannot be satisfied by a label that is simply missing.
    await breakTheRun(bob, [alice, charlie], BOB_BREAKER_ONE);
    await alice.sendMessage(MESSAGE_BEFORE);
    for (const recipient of recipients) {
      await recipient.waitForMessage(MESSAGE_BEFORE, MESSAGE_DELIVERY_TIMEOUT_MS);
      await recipient.assertNoMessageAuthorProBadge(MESSAGE_BEFORE);
    }

    await alice.subscribeToPro();
    // A restart does not surface a grant this client has never seen — the cold-launch fetch is gated on
    // already knowing there is access. Opening Pro settings fetches regardless, which is what this does.
    await alice.waitForProActive();
    // Being Pro and advertising it are separate: the badge bit rides in Alice's profile, so without this
    // her proof arrives with nothing asking the recipients to draw anything.
    await alice.enableProBadge();
    // The Pro settings navigation left Alice on the home screen, not in the group.
    await alice.openConversationWith(groupCreated.userName);

    await breakTheRun(bob, [alice, charlie], BOB_BREAKER_TWO);
    await alice.sendMessage(MESSAGE_AFTER);
    for (const recipient of recipients) {
      await recipient.waitForMessage(MESSAGE_AFTER, MESSAGE_DELIVERY_TIMEOUT_MS);
      await recipient.assertMessageAuthorProBadge(MESSAGE_AFTER);
    }
  },
  // Tags the test `@pro`; the state itself comes from the grant above, not from a mock.
  { pro: {} }
);
