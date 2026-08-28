import { Conversation } from '../../../desktop/locators';
import { test_Alice_1W_Bob_0W_friends } from '../../../desktop/sessionTest';
import {
  MESSAGE_DELIVERY_TIMEOUT_MS,
  PRO_MAX_CHARS,
  STANDARD_MAX_CHARS,
} from '../../../shared/constants';
import { boundary, early, late, OVER_PRO_LIMIT_CHARS, overflow } from '../../../shared/message';
import { sendOverProLimitMessage } from '../../../shared/pro_message';

const TAG = 'OVERPRO';

/**
 * What a recipient does with a message one character past the Pro limit: it cuts it at exactly the
 * limit.
 *
 * The receiving side of the rule, which no sender-side spec can reach — every client enforces the
 * limit in its composer, so the message can only be manufactured by the seeder (`sendProMessage`,
 * qa-seeder 0.6.0). Bob therefore has no window at all: he is an account, not a client.
 *
 * The sender is genuinely Pro rather than mocked, and that is load-bearing. Desktop chooses the limit
 * from the ARRIVING proof (`proProofEntitlesFeaturesNow`, then `[...body].slice(0, maxChars)` in
 * `ts/receiver/queuedJob.ts`), so a mocked sender's message would be cut at `STANDARD_MAX_CHARS` and
 * this spec would be measuring the wrong refusal.
 *
 * The four assertions are one measurement, not four attempts at it: each rules out one outcome, and
 * only "exactly `PRO_MAX_CHARS`" survives all four. The last two are a pair — `boundary` ends at the
 * limit and `overflow` is `boundary` plus the character past it — so dropping either would leave an
 * assertion that a client keeping the whole body also satisfies.
 *
 * **No "Read more" click, unlike the mobile twin's `expandLongMessages`.** Desktop's collapse is a pure
 * CSS clamp — `StyledMessageBubble` sets `-webkit-line-clamp` and `overflow: hidden` while `!expanded`,
 * over a node that already holds the whole body — and the locator's `text` option is `:has-text`, a
 * TEXT-CONTENT match that clipped overflow does not hide. So every marker below is readable while the
 * bubble is folded, and expanding first would change nothing. What this spec measures is what the
 * recipient STORED, not what it painted; the clamp itself is untested here and needs a different probe
 * (the Read more button, or `clientHeight` against `scrollHeight`).
 */
test_Alice_1W_Bob_0W_friends(
  `A ${OVER_PRO_LIMIT_CHARS}-character message from a Pro sender`,
  async ({ alice, bob, network }) => {
    // Sent with Alice's window already up, so her poll is seconds behind the mint. A proof that dies
    // before the message is parsed is read as no proof at all.
    await sendOverProLimitMessage({ from: bob, to: alice.getUser(), network, tag: TAG });

    // The anchor. Without it "the tail is missing" is equally well explained by the message never
    // arriving, and every assertion below would pass before the behaviour under test happened.
    await alice.waitForElement({
      locator: Conversation.messageContent,
      options: { text: early(TAG), maxWaitMs: MESSAGE_DELIVERY_TIMEOUT_MS },
    });

    try {
      await alice.waitForElement({
        locator: Conversation.messageContent,
        options: { text: late(TAG), maxWaitMs: 5_000 },
      });
    } catch {
      throw new Error(
        `${alice.getUser().userName}'s copy stops inside the standard limit of ${STANDARD_MAX_CHARS}, ` +
          `so this client did not honour ${bob.userName}'s proof. Either the proof failed to verify ` +
          `(check TEST_PRO_BACKEND_ED_PK) or it had already expired by the time the message was parsed.`
      );
    }

    try {
      await alice.waitForElement({
        locator: Conversation.messageContent,
        options: { text: boundary(TAG), maxWaitMs: 5_000 },
      });
    } catch {
      throw new Error(
        `${alice.getUser().userName}'s copy is missing the marker ending at ${PRO_MAX_CHARS}, so this ` +
          `client cut the body somewhere short of the Pro limit while still honouring the proof.`
      );
    }

    // Paired with the `boundary` wait above: `boundary` ends on PRO_MAX_CHARS and `overflow` is
    // `boundary` plus the one character past it, so only a body of exactly PRO_MAX_CHARS satisfies both.
    try {
      await alice.hasElementPoppedUpThatShouldnt(Conversation.messageContent, overflow(TAG));
    } catch {
      throw new Error(
        `${alice.getUser().userName} kept the character past ${PRO_MAX_CHARS}, so this client stored ` +
          `all ${OVER_PRO_LIMIT_CHARS} characters ${bob.userName} sent. The limit is not enforced on ` +
          `receive.`
      );
    }
  },
  // Tags the test `@pro` without arming a mock — the sender's entitlement is a real grant the seeder
  // fetched, and this window verifies it against the QA backend key from the environment.
  { pro: {} }
);
