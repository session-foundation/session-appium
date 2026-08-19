import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import {
  COUNTDOWN_START_THRESHOLD,
  PRO_MAX_CHARS,
  STANDARD_MAX_CHARS,
} from '../../../shared/constants';
import { revokeAccountPro } from '../../../shared/pro_grant';

const PRO_CONTEXT = { pro: { forceProRevocationRefresh: true } } as const;

const EARLY_AT = 500;
const LATE_AT = STANDARD_MAX_CHARS + 500;
/** Matches `pro_overhang`: the largest length the composer accepts without sitting on the boundary. */
const TOTAL = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

const early = (tag: string) => `EARLY-${tag}`;
const late = (tag: string) => `LATE-${tag}`;

/**
 * Two markers per message, placed so that each end's copy is identified by which of them survives.
 *
 * `EARLY` sits inside the standard limit, so it is present in every outcome — including a copy that
 * arrived truncated. It is the anchor: without it, "the tail is missing" is equally well explained by the
 * message never arriving, and the assertion would pass before the behaviour under test happened.
 *
 * `LATE` sits past the standard limit and inside the Pro one, so it survives only if the recipient
 * honoured the proof.
 *
 * The positions are checked rather than trusted, because getting them wrong fails in the flattering
 * direction: a message that never contained its `EARLY` marker fails as a 90-second wait on the
 * recipient, which reads as a delivery problem. That is exactly how the first version of this failed.
 */
function markedMessage(tag: string): string {
  const head = 'a'.repeat(EARLY_AT) + early(tag);
  const withLate = head + 'b'.repeat(LATE_AT - head.length) + late(tag);
  const message = withLate + 'c'.repeat(TOTAL - withLate.length);

  const earlyEnd = message.indexOf(early(tag)) + early(tag).length;
  const lateStart = message.indexOf(late(tag));
  if (
    message.length !== TOTAL ||
    earlyEnd > STANDARD_MAX_CHARS ||
    lateStart <= STANDARD_MAX_CHARS
  ) {
    throw new Error(
      `markedMessage(${tag}): ${message.length} chars, EARLY ends ${earlyEnd}, LATE starts ${lateStart} ` +
        `— the markers must straddle the standard limit of ${STANDARD_MAX_CHARS} or neither assertion means anything.`
    );
  }
  return message;
}

/**
 * A revoked proof does not buy the Pro message limit at the recipient.
 *
 * The spec for the defect the revocation work uncovered: the receive path decided a message's Pro
 * features from the bitset the message declared, without asking whether the proof behind it had been
 * revoked — so a revoked sender kept the higher character limit on every recipient, indefinitely.
 *
 * 🔴 **Both halves are mandatory, and the FIRST one is the one that makes this spec mean anything.**
 * The recipient's limit is chosen from its *stored* record of the sender
 * (`sendingDeviceConversation.hasValidCurrentProProof()`), not from the arriving message. So a recipient
 * that never knew the sender as Pro applies the standard limit for an entirely innocent reason. Without
 * the control below, "truncated" would be satisfied by that — and the spec would pass with the fix
 * reverted.
 *
 * 🔴 **The ordering is the opposite of `pro_revocation_recipient`'s, and it is not a preference.** The
 * badge is re-evaluated live, so revoking after a message still clears it. This decision is made ONCE, at
 * receipt, and the truncated body is what gets persisted — so a revocation arriving afterwards can never
 * retroactively truncate anything. Bob must hold the revocation BEFORE the second message is parsed.
 *
 * Alice is deliberately not restarted, so she never learns of the revocation and keeps composing at, and
 * sending with, the dead credential. Her own copies keep their full text: truncation is receive-side, and
 * that asymmetry is the ruling rather than an accident — a recipient switching to a modified client must
 * not gain retrospective access to content it was never entitled to read. It is also why asserting only
 * the sender would pass with the fix reverted.
 */
test_Alice_1W_Bob_1W_friends(
  'A revoked proof does not buy the Pro message limit at the recipient',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await alice.waitForProActive();
    await alice.openConversationWith(bob.userName);

    const honoured = markedMessage('HONOURED');
    await alice.pasteIntoInput('message-input-text-area', honoured);
    await alice.sendMessage(honoured);
    // The control: Bob stores 9,800 characters from Alice while her proof is good. This establishes both
    // that he knows her as Pro and that he is willing to keep a message this long — the two innocent
    // explanations for the truncation asserted below.
    await bob.waitForMessage(late('HONOURED'), 90_000);

    await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: 0,
    });

    // Bob learns of it BEFORE the next message exists. The relaunch is what forces the poll — the backend
    // serves a 24h cadence, so waiting it out is not an option.
    await restartApp(bob, PRO_CONTEXT);
    // A relaunch lands on the conversation list, and `message-content` only exists inside an open
    // conversation — so without this every message assertion below waits forever on an element that
    // cannot render, and reports it as a delivery failure.
    await bob.openConversationWith(alice.userName);

    const refused = markedMessage('REFUSED');
    await alice.pasteIntoInput('message-input-text-area', refused);
    await alice.sendMessage(refused);
    // The sender still holds ACCESS: a client only drops a revoked proof at its own next poll, and Alice
    // has not polled. If this fails she never sent as Pro, and the recipient assertion would be measuring
    // nothing.
    await alice.waitForMessage(late('REFUSED'));

    // `EARLY` first and separately: it proves the message arrived, so the absence of `LATE` afterwards
    // can only mean it was cut.
    await bob.waitForMessage(early('REFUSED'), 90_000);
    // Rethrown with the meaning attached: the shared helper reports only "Found message-content, oops..",
    // which for this spec's central assertion names neither the marker nor what its presence implies.
    try {
      await bob.hasElementPoppedUpThatShouldnt(
        { strategy: 'data-testid', selector: 'message-content' },
        late('REFUSED')
      );
    } catch {
      throw new Error(
        `${bob.getUser().userName} kept text from beyond the standard limit (${late('REFUSED')} sits at ` +
          `${LATE_AT}, past ${STANDARD_MAX_CHARS}), so this client honoured the Pro limit for a sender ` +
          `whose proof was revoked. Its copy should have been cut at ${STANDARD_MAX_CHARS} characters.`
      );
    }
  },
  PRO_CONTEXT
);
