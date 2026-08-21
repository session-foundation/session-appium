import { Conversation } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { sleepFor } from '../../../shared/promise_utils';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';

const SENT_WITH_FAKE_PROOF = 'Sent with a fake proof';

/**
 * The body text says "fake proof" because that is what it is FROM THE RECIPIENT'S SIDE, which is the side
 * under test. The proof is genuinely minted and genuinely signed; the recipient just trusts a different
 * key, so it cannot tell this from a forgery — which is the whole point.
 */

/** How long the badge is given to appear before its absence is called a refusal. See the mobile spec. */
const BADGE_SETTLE_MS = 15_000;

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
    await alice.sendMessage(SENT_WITH_FAKE_PROOF);

    // Half the control, travelling with the spec: the message went out WITH a genuine proof. Read from
    // the sender's own copy — the conversation header badge shows the OTHER party's status, so on the
    // sender's device it would assert the recipient's.
    await alice.assertMessageProFeatures(SENT_WITH_FAKE_PROOF, ['proBadge']);

    // The relaunch above left this window on the conversation LIST, and `waitForMessage` only watches
    // the OPEN conversation — so without this it waits out its timeout on a screen that has no messages
    // on it, while the message itself has arrived and the list even shows the sender as Pro.
    await bob.openConversationWith(alice.userName);

    // The message must arrive first, or an absent badge says nothing.
    await bob.waitForMessage(SENT_WITH_FAKE_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);

    // The claim, asserted as "never appears" rather than "is not there yet".
    //
    // `assertNoSenderProBadge` is deliberately NOT used: it exists for the revocation specs, where the
    // badge starts present and must vanish, so it returns the first moment it sees no badge — and on
    // desktop it checks with a bare `isVisible()`, with no grace at all. Here the badge should never
    // appear, and in the matching-key control it renders a second or two after the message, so looking
    // once immediately would pass whatever the client decided.
    await sleepFor(BADGE_SETTLE_MS);
    await bob
      .getPage()
      .locator(
        `[${Conversation.proBadgeConversationHeader.strategy}="${Conversation.proBadgeConversationHeader.selector}"]`
      )
      .first()
      .waitFor({ state: 'hidden', timeout: 2_000 });
  }
);
