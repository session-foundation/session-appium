import { CTA } from '../../../desktop/locators';
import { joinCommunities, pinConversation, pinIconFor } from '../../../desktop/pin';
import { test_Alice_1W } from '../../../desktop/sessionTest';

/** The pinned-conversation limit for a standard account. */
const STANDARD_PIN_LIMIT = 5;
const COMMUNITY_COUNT = 6;

/**
 * Refused, and not sold to.
 *
 * The gate is an ACCESS question — no usable proof, so the action cannot be allowed. The prompt is a
 * DISPLAY question — the plan reads active, so offering to sell Pro would be offering something the user
 * already has. The two answers come from different values, and this is the state where they differ.
 *
 * The refusal is therefore SILENT, which is a deliberate trade rather than an oversight: no copy exists
 * for "your plan is active but we cannot verify it yet", and the alternatives are worse — a purchase
 * prompt aimed at a subscriber, or a wrong explanation. This spec exists to hold that in place. A client
 * that "fixes" the silence by reinstating the upsell fails here, which is the point: that fix looks like
 * an improvement at the call site and is the bug the split was made to remove.
 *
 * Both halves are asserted. A prompt appearing is not the same as the action being refused, and the
 * action being refused is not the same as no prompt appearing — an implementation that showed the prompt
 * and pinned anyway satisfies either assertion alone.
 */
test_Alice_1W(
  'An active plan with no proof is refused without being sold to',
  async ({ alice }) => {
    const names = await joinCommunities(alice, COMMUNITY_COUNT);

    // The standard limit applies, because the limit is ACCESS.
    for (const name of names.slice(0, STANDARD_PIN_LIMIT)) {
      await pinConversation(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    const overLimit = names[STANDARD_PIN_LIMIT];
    await pinConversation(alice, overLimit);

    // The assertion that carries this spec: the standard-account version of this step shows the
    // pinned-conversations CTA here, and this state must not.
    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);
    // And the pin itself is still refused — the gate reads the proof, which is absent.
    await pinIconFor(alice, overLimit).waitFor({ state: 'hidden' });
  },
  {
    // Active with time left, and nothing to prove it with. The expiry is not optional: an `active`
    // status with none inherits zero, which the client reads as expiring imminently and answers with a
    // CTA — which is the very thing this spec asserts the absence of.
    pro: {
      proBackendStatus: 'active',
      proAccessExpiry: 'P30D',
      proLoadingState: 'success',
      proProof: 'none',
    },
    communityRooms: COMMUNITY_COUNT,
  }
);
