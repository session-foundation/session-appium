import { PRO_MAX_CHARS } from '../../../shared/constants';
import { bothPlatformsIt } from '../../../types/sessionIt';

/** One character past the largest body the product allows anyone to send. */
const OVER_PRO_LIMIT_CHARS = PRO_MAX_CHARS + 1;

bothPlatformsIt({
  title: `A ${OVER_PRO_LIMIT_CHARS}-character message from a Pro sender`,
  risk: 'high',
  testCb: overProLimitMessage,
  countOfDevicesNeeded: 1,
  isPro: true,
  shouldSkip: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'What a recipient does with a message one character over the Pro character limit, carrying a ' +
    'genuine backend-signed proof. Pending: the seeder cannot manufacture the message yet.',
});

/**
 * A body no compliant client will ever send.
 *
 * `STANDARD_MAX_CHARS` is 2,000 and `PRO_MAX_CHARS` is 10,000, and both are enforced in the composer, so
 * every existing limit spec is written from the SENDER's side: it types up to a limit and asserts what the
 * client allows. One character past the Pro limit cannot be reached that way at all — no client will
 * compose it — which leaves the receiving side of the rule untested. The interesting question is not
 * whether a client refuses to send 10,001 characters, it is what a client does when one arrives: accept
 * it whole, truncate it to 10,000, drop it, or fail to render the conversation.
 *
 * The sender has to be genuinely Pro rather than mocked, because the recipient VERIFIES the proof before
 * it will honour anything past 2,000 characters. A mocked sender's message arrives truncated to the
 * standard limit, and the spec would then be asserting the wrong refusal.
 *
 * ⏳ PENDING — needs a seeder action that does not exist yet. Nothing here should be un-skipped until it
 * lands and `@session-foundation/qa-seeder` is bumped to the version carrying it. What it needs:
 *
 *   await sendProMessage({ from, to, body, network, proBackendUrl });
 *
 *   - `from` / `to`: two seeded accounts that are already mutual contacts, so the message lands in a
 *     conversation rather than as a message request. `2friends` provides them.
 *   - `from` gets a real Pro proof fetched from the backend at `proBackendUrl` and attached to the
 *     message, so the recipient's verification succeeds.
 *   - `body`: `OVER_PRO_LIMIT_CHARS` characters, sent WITHOUT the composer's limit check — which is the
 *     part only the seeder can do.
 *
 * The fixture this spec then wants is one device for the RECIPIENT only: the sender is the seeder, so
 * opening an app for it would cost a device and prove nothing. `open_Alice1_Bob1_friends` opens two, so
 * either it grows a one-device variant or this spec leaves the sender's device idle.
 *
 * Once the message can be manufactured, what to assert is still a product decision — accepted whole,
 * truncated at 10,000, or refused — and this stub deliberately does not guess.
 */
function overProLimitMessage(): Promise<void> {
  return Promise.reject(
    new Error(
      'pro_over_pro_limit_message is pending: qa-seeder has no sendProMessage() action yet. See the note above this function.'
    )
  );
}
