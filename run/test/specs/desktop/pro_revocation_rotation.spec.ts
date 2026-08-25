import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { revokeAccountPro } from '../../../shared/pro_grant';
import {
  DESKTOP_PRO_CONTEXT,
  SENT_ON_NEW_PROOF,
  SENT_ON_OLD_PROOF,
} from '../../../shared/pro_revocation';

/**
 * Rotation end to end, and the counterpart to the refund spec.
 *
 * Both revoke the proof the sender holds; only the refund takes the entitlement with it. A client that
 * cannot separate them fails one way or the other — strip Pro from a paying subscriber, or leave a refunded
 * account Pro — so the two are a pair and neither means much alone.
 *
 * One spec rather than a sender-side and a recipient-side half because nothing the sender can show
 * distinguishes a live proof from a dead one: every sender-side surface reads the entitlement, not the
 * proof. So the sender can only establish that the subscription survived, and whether the credential was
 * actually replaced is a question only a peer can answer.
 *
 * Ordering is load-bearing. The rejection is asserted BEFORE the sender's next message: a proof travels
 * with a message, so the moment one arrives on the new generation the recipient's record is updated and the
 * absence being asserted is gone.
 */
test_Alice_1W_Bob_1W_friends(
  'A rotation keeps the subscription and swaps which proof is honoured',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await alice.waitForProActive();
    // Badge visibility is a separate per-user setting, off by default, and a grant does not touch it.
    await alice.enableProBadge();

    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_ON_OLD_PROOF);
    // Waited on before the badge: the badge follows the sender's profile, which rides along with the
    // message, so asserting the badge first races the delivery.
    await bob.waitForMessage(SENT_ON_OLD_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);

    // The control: an absence later means nothing unless the badge was there first.
    await bob.assertConversationHeaderProBadge(alice.userName);

    // `revokePayments: false` is the whole difference from the refund spec. The helper refuses to continue
    // if the backend allocated no replacement, so a rotation that quietly behaved like a refund fails here
    // rather than misleading everything downstream.
    await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: 0,
    });

    // Alice only drops a revoked proof at her next poll, which the relaunch forces.
    await restartApp(alice, DESKTOP_PRO_CONTEXT);
    // An assertion, not a readiness wait: a rotation leaves the subscription intact, so going non-Pro
    // here would mean it behaved like a refund.
    await alice.waitForProActive();

    // Bob has to poll to learn of the rotation, and the relaunch is what forces it.
    await restartApp(bob, DESKTOP_PRO_CONTEXT);
    await bob.assertNoConversationHeaderProBadge(alice.userName, SENT_ON_OLD_PROOF);

    // Alice re-armed above, so this carries the new generation's proof — which is also how Bob comes to
    // hold it, since a proof travels with the message rather than arriving on its own.
    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_ON_NEW_PROOF);
    await bob.waitForMessage(SENT_ON_NEW_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);
    await bob.assertConversationHeaderProBadge(alice.userName);
  },
  DESKTOP_PRO_CONTEXT
);
