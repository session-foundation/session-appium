import { Conversation } from '../../../desktop/locators';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';

/** Comfortably past the standard cap, comfortably under the Pro one. */
const OVER_STANDARD = 3000;
const STANDARD_MAX_CHARS = 2000;

/**
 * A client that believes it is Pro but holds no proof must not offer the Pro message limit.
 *
 * Pro *status* and a Pro *proof* answer different questions: the status is the plan's state, which only
 * the backend knows, while the proof is the entitlement that travels with the message and is what a
 * recipient validates against. A message length is the second question, so it has to read the proof.
 *
 * Read the status instead and the two ends disagree permanently: measured at 3000 characters sent and
 * 2000 stored by the recipient, with nothing shown at either end. The recipient truncates because no
 * proof arrived to justify the extra length, and the sender's own copy keeps the full text — so the
 * conversation holds two different messages and neither participant is told.
 *
 * The fixture needs no grant and no restore. A mocked active status supplies the status half while the
 * config stays empty, which is the state exactly: entitlement claimed, nothing to prove it with.
 */
test_Alice_1W_Bob_1W(
  'No Pro proof means no Pro message limit',
  async ({ alice, bob }) => {
    await alice.createContactWith(bob);
    await alice.openConversationWith(bob.userName);

    // The countdown reflects the limit the client is applying, so it fails here rather than after a
    // send, where the only evidence would be a length mismatch between two devices.
    await alice.pasteIntoInput('message-input-text-area', 'z'.repeat(OVER_STANDARD));
    await alice.waitForElement({
      locator: Conversation.tooltipCharacterCount,
      options: { text: String(STANDARD_MAX_CHARS - OVER_STANDARD) },
    });
  },
  { pro: { proBackendStatus: 'active', proLoadingState: 'success' } }
);
