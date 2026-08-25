import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { revokeAccountPro } from '../../../shared/pro_grant';
import {
  DESKTOP_PRO_CONTEXT,
  REVOCATION_EFFECTIVE_IN_SECONDS,
  REVOCATION_POLL_SETTLE_MS,
  SENT_BEFORE_REVOCATION,
} from '../../../shared/pro_revocation';
import { sleepFor } from '../../../shared/promise_utils';

/**
 * The delay in a revocation is a guarantee, not slack.
 *
 * A served revocation carries its own `effective_ts`, dated ahead of when it was recorded so a revoked
 * sender is certain to have polled and learnt of its own tag before any peer starts rejecting it. The list
 * is served unfiltered — every entry inside the retention window, effective or not — so honouring the
 * delay is entirely the client's decision, which is what makes it worth asserting.
 *
 * Both halves are required and the second is the control for the first: "the badge is still there" is
 * satisfied by a client that never fetched the list, so only the SAME client dropping the badge once the
 * instant passes establishes the entry was held the whole time.
 *
 * Revoked as a ROTATION, not a refund: Alice keeps her entitlement and rolls onto a fresh generation, so
 * the only thing that changes is the status of the proof Bob already holds. A refund would also end her
 * subscription, giving a missing badge an innocent explanation.
 *
 * Alice is never restarted — she would re-arm on the new generation and send from a live proof, leaving
 * nothing pending for Bob to weigh.
 *
 * The two clients that implement this diverge in a way this spec is meant to pin down: Android
 * re-evaluates effectiveness on every read (`ProDatabase.kt:143`) and passes, while iOS caches a derived
 * state and invalidates it from events, and does not.
 */
test_Alice_1W_Bob_1W_friends(
  'A revocation is not honoured before it takes effect',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await alice.waitForProActive();
    // Badge visibility is a separate per-user setting, off by default, and a grant does not touch it.
    // Without it no badge renders for Bob and both halves assert nothing.
    await alice.enableProBadge();

    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_BEFORE_REVOCATION);
    // Waited on before the badge: the badge follows the sender's profile, which rides along with the
    // message, so asserting the badge first races the delivery.
    await bob.waitForMessage(SENT_BEFORE_REVOCATION, MESSAGE_DELIVERY_TIMEOUT_MS);
    await bob.assertConversationHeaderProBadge(alice.userName);

    const { effective_ts } = await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: REVOCATION_EFFECTIVE_IN_SECONDS,
    });
    const effectiveAtMs = effective_ts * 1000;

    // The relaunch is what makes Bob poll, so afterwards he holds the entry with its instant still ahead.
    await restartApp(bob, DESKTOP_PRO_CONTEXT);
    await sleepFor(REVOCATION_POLL_SETTLE_MS);
    await bob.assertConversationHeaderProBadge(alice.userName);

    // Fails loudly as a timing shortfall rather than quietly weakening the claim: past the instant, the
    // assertion above proved nothing about a PENDING revocation.
    if (Date.now() >= effectiveAtMs) {
      throw new Error(
        `The revocation became effective before the badge could be asserted, so nothing was verified ` +
          `about a pending revocation. Raise REVOCATION_EFFECTIVE_IN_SECONDS above ${REVOCATION_EFFECTIVE_IN_SECONDS}s for ` +
          `this host.`
      );
    }

    // To a DEADLINE rather than a fresh countdown: proving the first half already burned part of the delay.
    await sleepFor(Math.max(0, effectiveAtMs - Date.now()));
    await restartApp(bob, DESKTOP_PRO_CONTEXT);
    await bob.assertNoConversationHeaderProBadge(alice.userName, SENT_BEFORE_REVOCATION);
  },
  DESKTOP_PRO_CONTEXT
);
