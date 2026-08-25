import { CTA } from '../../../desktop/locators';
import { pinConversation, pinConversationConfirmed, pinIconFor } from '../../../desktop/pin';
import { test_Alice_1W_10contacts } from '../../../desktop/sessionTest';
import { STANDARD_PIN_LIMIT } from '../../../shared/constants';

/**
 * The pinned-conversation limit either side of the Pro boundary: five for a standard user, more for a
 * subscriber.
 *
 * Communities rather than contacts because they populate the conversation list without another party
 * replying, and taking the set from the shared `getCommunities()` means both platforms pin the same
 * rooms.
 *
 * Both specs assert the **pin icon**, not just the absence of a CTA: a limit that refused every pin,
 * or that showed the CTA and pinned anyway, satisfies a CTA-only assertion.
 */

/** Enough conversations to exceed the standard limit, which is what both specs turn on. */
const CONVERSATION_COUNT = 6;

test_Alice_1W_10contacts(
  'Pinned conversation limit (non Pro)',
  async ({ alice, contactNames }) => {
    const names = contactNames;

    for (const name of names.slice(0, STANDARD_PIN_LIMIT)) {
      await pinConversationConfirmed(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    const overLimit = names[STANDARD_PIN_LIMIT];
    await pinConversation(alice, overLimit);
    await alice.checkCTA('pinnedConversations');
    await alice.clickOn(CTA.cancelButton);

    // The CTA appearing is not the same as the pin being refused.
    await pinIconFor(alice, overLimit).waitFor({ state: 'hidden' });
  },
  { pro: { proBackendStatus: 'never' } }
);

test_Alice_1W_10contacts(
  'Pinned conversation limit (Pro)',
  async ({ alice, contactNames }) => {
    // More than the standard limit, which is what the assertion turns on; the rest are surplus.
    const names = contactNames.slice(0, CONVERSATION_COUNT);

    for (const name of names) {
      await pinConversationConfirmed(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);
  },
  {
    // The pinned limit is an ACCESS question, so it reads the proof rather than the plan's state — a
    // status-only fixture would pin like a free user and fail here for the wrong reason.
    pro: { proBackendStatus: 'active', proAccessExpiry: 'P30D', proProof: 'valid' },
  }
);
