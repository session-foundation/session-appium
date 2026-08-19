import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { revokeAccountPro } from '../../../shared/pro_grant';

/**
 * Forcing the revocation poll is the whole reason this spec can run.
 *
 * The backend serves the production cadence — `retry_in: 86400`, and inside libSession's [60s, 48h] clamp,
 * so nothing shortens it — which puts a client's second poll a day after its first. Without the flag Bob
 * never learns of the revocation inside the run, and the assertion below would pass on a client that had
 * simply not looked.
 */
const PRO_CONTEXT = { pro: { forceProRevocationRefresh: true } } as const;

/**
 * The only spec in which a SECOND party decides whether a Pro credential is good.
 *
 * Everything else about Pro can be satisfied by a client believing its own claim about itself. Here Bob
 * verifies Alice's proof, and the revocation list is the one input that can make a cryptographically
 * valid, unexpired proof worthless. That makes it the sharpest test of the credential being real: a
 * display-level mock produces nothing for Bob to reject, and a client that ignores the list renders a
 * badge for a sender the backend has disavowed.
 *
 * The order is load-bearing. Alice sends while her proof is live and Bob is asserted to honour it FIRST,
 * because the interesting assertion is an absence and an absence proves nothing on its own — a badge that
 * was never there satisfies the second half perfectly. The pair is what distinguishes "stopped honouring"
 * from "never honoured".
 *
 * Revoked as a ROTATION rather than a refund: Alice keeps her entitlement and rolls onto a fresh
 * generation, so the only thing that changed is that the proof already in Bob's hands is dead. A refund
 * would also strip Alice's Pro, and then a missing badge would be explained by her no longer being a
 * subscriber at all — true, and not what this asserts.
 *
 * Alice is deliberately NOT restarted after the revocation. Every client drops a revoked proof within one
 * poll of noticing, so restarting her would re-arm her on the new generation and there would be no dead
 * credential left for Bob to reject.
 */
test_Alice_1W_Bob_1W_friends(
  'A recipient stops honouring a sender whose proof has been revoked',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    // No restart: a cold launch will not surface a grant this client has never seen, because that fetch
    // is gated on already knowing there is access. Opening Pro settings fetches regardless, which is what
    // `waitForProActive` does.
    await alice.waitForProActive();
    // Being Pro is not the same as advertising it: badge visibility is a separate per-user setting, off by
    // default, and a grant does not touch it. Without this the badge never renders for Bob and the
    // revocation assertion below would pass against a client that had nothing to withdraw.
    await alice.enableProBadge();

    await alice.openConversationWith(bob.userName);
    const message = 'Sent while my proof was still good';
    await alice.sendMessage(message);
    // Waited on before the badge, because the badge follows the sender's PROFILE rather than the message
    // and the profile rides along with it. Asserting the badge first can race the delivery.
    await bob.waitForMessage(message, 90_000);

    // The control, and the half a mock cannot reach: Bob has verified a real signature against the
    // backend's key. Measured against a display-level fixture, no badge appears here at all.
    await bob.assertSenderProBadge(alice.userName);

    await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: 0,
    });

    // Bob has to POLL to learn of it — the revocation is not pushed to him. The relaunch is what forces
    // that poll, and on iOS it also forces the view rebuild the badge needs; keeping the same shape on
    // all three clients is why it is a restart here rather than a wait.
    await restartApp(bob, PRO_CONTEXT);
    await bob.assertNoSenderProBadge(alice.userName, message);
  },
  PRO_CONTEXT
);
