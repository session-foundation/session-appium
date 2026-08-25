import { Conversation } from '../../../desktop/locators';
import { dismissAnyProCTA } from '../../../desktop/pro_cta';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_10contacts } from '../../../desktop/sessionTest';
import { revokeAccountPro } from '../../../shared/pro_grant';
import { OVER_STANDARD_CHARS } from '../../../shared/pro_revocation';

/**
 * The matched pair to the overhang spec, and the only case where a client has to police its OWN
 * credential.
 *
 * `Pro features survive the plan expiring` establishes that a lapsed plan does not stop the features:
 * access comes from the proof, the proof outlives the plan, and the client keeps serving Pro while
 * displaying an expired plan. A refund has to break that. Revoking the payments rotates the account onto
 * a fresh generation, which puts the proof the client still holds on the revocation list, so the
 * credential is dead rather than unrenewed.
 *
 * Getting it wrong is invisible from the outside: the client keeps composing at the Pro limit against a
 * proof every recipient rejects, and the two ends of the conversation hold different messages.
 *
 * The composer's limit is the whole claim. The status side cannot carry it: after a refund the plan reads
 * inactive and the Pro stats header is gone, which is what the overhang spec asserts for a plan that
 * merely lapsed, so nothing on the Pro settings screen separates the two cases.
 *
 * A real grant rather than a mock, because a display-level mock leaves no proof for a revocation to
 * invalidate.
 */
test_Alice_1W_10contacts(
  'A refund revokes Pro from the account itself, not just its plan',
  async ({ alice, contactNames }) => {
    // Any seeded contact: the limit is the sender's own decision, so the conversation only has to exist.
    const [contact] = contactNames;

    await alice.subscribeToPro();
    await alice.waitForProActive();

    // The control the whole spec rests on. "The composer applies the standard limit" is satisfied
    // perfectly by a grant that never worked, so the Pro limit has to be observed first.
    await alice.openConversationWith(contact);
    await alice.pasteIntoInput('message-input-text-area', 'x'.repeat(OVER_STANDARD_CHARS));
    // The countdown appears only within 200 of the limit, so at this length it is absent under the Pro
    // limit and shown under the standard one. `hidden` also covers never-attached.
    await alice
      .getPage()
      .locator(
        `[${Conversation.tooltipCharacterCount.strategy}="${Conversation.tooltipCharacterCount.selector}"]`
      )
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 });

    // `revokePayments` is what makes this a refund rather than the rotation the recipient-facing specs
    // use: it strips the entitlement as well as rotating the generation, so the client is left holding a
    // proof that is both unrenewable and revoked.
    await revokeAccountPro({ user: alice.getUser(), revokePayments: true });
    // Forces the revocation poll, and rebuilds the composer that reads the limit.
    await restartApp(alice, { pro: { forceProRevocationRefresh: true } });
    await dismissAnyProCTA(alice, 5_000);

    // The claim: the client applies the standard limit to itself, because the proof it holds has been
    // revoked.
    await alice.openConversationWith(contact);
    await alice.pasteIntoInput('message-input-text-area', 'x'.repeat(OVER_STANDARD_CHARS));
    await alice.waitForElement({ locator: Conversation.tooltipCharacterCount });
  },
  // A precondition, not a convenience. The backend serves the production cadence — `retry_in: 86400`,
  // inside libSession's [60s, 48h] clamp — so a client's second revocation poll is a day after its
  // first. Without this the client never learns of the refund inside the run.
  { pro: { forceProRevocationRefresh: true } }
);
