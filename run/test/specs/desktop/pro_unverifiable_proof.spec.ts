import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';

const SENT_WITH_REAL_PROOF = 'Sent with a genuine proof';

/**
 * A REAL Ed25519 public key that the Pro backend never signs with.
 *
 * Generated once and pinned so runs are reproducible. It must be a valid curve point, not merely
 * well-formed hex: a key the client cannot parse is rejected as "invalid key" rather than treated as a
 * different signer, and on Desktop that throws in a loop which kills swarm polling — so the recipient
 * then receives nothing at all and the spec fails for a reason unrelated to verification.
 */
const UNTRUSTED_BACKEND_KEY = '19151761ab6c9db89e8380604cf9ebe1a60267ef6d93636b4fcadd7d29f2b571';

/**
 * The verification path, exercised with a REAL proof and an untrusted signer.
 *
 * The half no mock can reach: a display-level mock makes a client believe it is Pro but attaches nothing
 * to the message, so the recipient refuses nothing and the assertion passes on a message that never
 * carried a claim. Here the claim is genuine and the recipient simply cannot verify who signed it.
 *
 * The recipient is relaunched onto the untrusted key BEFORE the message is sent, because verification
 * happens at receipt — a window restarted afterwards reads its stored record and would show whatever it
 * already decided.
 *
 * Verified as a matched pair on mobile, where the same fixture with both clients on the real key has the
 * recipient SHOW the badge (iOS 39s, Android 43s) and only the untrusted key removes it. That is what
 * makes the absence attributable to verification rather than to a missing claim.
 */
test_Alice_1W_Bob_1W_friends(
  'A recipient does not honour a proof it cannot verify',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await alice.waitForProActive();
    // Badge visibility is a per-user setting, off by default; without it nothing is claimed.
    await alice.enableProBadge();

    // Only the recipient's trust changes. Before the send, since verification happens at receipt.
    await restartApp(bob, { pro: { proBackendPubkey: UNTRUSTED_BACKEND_KEY } });

    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_WITH_REAL_PROOF);

    // Half the control, travelling with the spec: the message went out WITH a genuine proof. Read from
    // the sender's own copy — the conversation header badge shows the OTHER party's status, so on the
    // sender's device it would assert the recipient's.
    await alice.assertMessageProFeatures(SENT_WITH_REAL_PROOF, ['proBadge']);

    // The relaunch above left this window on the conversation LIST, and `waitForMessage` only watches
    // the OPEN conversation — so without this it waits out its timeout on a screen that has no messages
    // on it, while the message itself has arrived and the list even shows the sender as Pro.
    await bob.openConversationWith(alice.userName);

    // The claim. The message must arrive first: `assertNoSenderProBadge` anchors on it, so a badge-less
    // screen cannot be satisfied by a message that never landed.
    await bob.waitForMessage(SENT_WITH_REAL_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);
    await bob.assertNoSenderProBadge(alice.userName, SENT_WITH_REAL_PROOF);
  }
);
