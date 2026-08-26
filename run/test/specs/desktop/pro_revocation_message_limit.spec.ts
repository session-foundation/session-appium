import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS, STANDARD_MAX_CHARS } from '../../../shared/constants';
import { early, late, LATE_AT, markedMessage } from '../../../shared/message';
import { revokeAccountPro } from '../../../shared/pro_grant';
import { DESKTOP_PRO_CONTEXT } from '../../../shared/pro_revocation';

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
    await bob.waitForMessage(late('HONOURED'), MESSAGE_DELIVERY_TIMEOUT_MS);

    await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: 0,
    });

    // Bob learns of it BEFORE the next message exists. The relaunch is what forces the poll — the backend
    // serves a 24h cadence, so waiting it out is not an option.
    await restartApp(bob, DESKTOP_PRO_CONTEXT);
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
    await bob.waitForMessage(early('REFUSED'), MESSAGE_DELIVERY_TIMEOUT_MS);
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
  DESKTOP_PRO_CONTEXT
);
