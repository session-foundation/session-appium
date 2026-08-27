import { expect } from '@playwright/test';

import { test_Alice_1W_10contacts } from '../../../desktop/sessionTest';
import { messageOfLength, OVER_STANDARD_CHARS } from '../../../shared/message';
import { MOVABLE_PRO_STATS } from '../../utils/pro_settings';

/**
 * The Desktop half of `mobile/pro_stats_usage` — see that spec for why a real grant is required and
 * why the assertions are deltas rather than absolutes.
 *
 * Desktop-specific traps:
 * - `pinConversation` needs the `pin-conversation-menu-item` id (session-desktop #1997). Without it the
 *   item falls back to the shared `context-menu-item` that every row in the menu carries.
 * - Each send goes to a DIFFERENT contact, so a counter that moved is attributable to that send rather
 *   than to a resend or a retry in a thread already carrying one.
 */
test_Alice_1W_10contacts(
  'Pro stats count real usage',
  async ({ alice, contactNames }) => {
    const [longMessageRecipient, badgedMessageRecipient] = contactNames;

    await alice.subscribeToPro();
    // Opening the Pro page is what fetches the grant; a restart alone would not surface it.
    await alice.waitForProActive();

    // Read rather than assumed to be zero: the claim is the delta, and a fixture that arrived with a
    // pinned conversation should not fail this.
    const baseline = await alice.readProStats();
    expect(baseline['badges-sent']).toEqual(0);
    expect(baseline['longer-messages']).toEqual(0);
    expect(baseline['pinned-conversations']).toEqual(0);

    await alice.openConversationWith(longMessageRecipient);
    await alice.sendMessage(messageOfLength(OVER_STANDARD_CHARS));

    // The whole reading, not just the cell that moved: a client counting every outgoing message would
    // bump badges-sent here too, and a per-cell assertion would miss it.
    expect(await alice.readProStats()).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
    });

    await alice.enableProBadge();

    await alice.openConversationWith(badgedMessageRecipient);
    await alice.sendMessage('Badged');

    // Short, so it carries the badge and not the length feature — the mirror image of the send above,
    // and together they say the two cells read different bits rather than the same one twice.
    expect(await alice.readProStats()).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
      'badges-sent': baseline['badges-sent'] + 1,
    });

    await alice.pinConversation(longMessageRecipient);

    // A different mechanism from the two above — a live count of currently-pinned threads rather than a
    // tally of sends — which is why it is worth the extra reading rather than being taken on trust.
    expect(await alice.readProStats()).toEqual({
      ...baseline,
      'longer-messages': baseline['longer-messages'] + 1,
      'badges-sent': baseline['badges-sent'] + 1,
      'pinned-conversations': baseline['pinned-conversations'] + 1,
    });

    // Guards the shape rather than the numbers: a stat added to MOVABLE_PRO_STATS without a step here
    // would otherwise be asserted only as "unchanged".
    expect(Object.keys(baseline).sort()).toEqual([...MOVABLE_PRO_STATS].sort());
  },
  { pro: {} }
);
