import { expect, test } from '@playwright/test';

import type { IBaseDeviceWrapper } from '../../../types/IBaseDeviceWrapper';
import type { ClientPlatform } from '../../../types/target';
import type { AccountClients } from '../../utils/cross_platform';
import type { MovableProStat, ProStatCounts } from '../../utils/pro_settings';

import { messageOfLength, OVER_STANDARD_CHARS } from '../../../shared/message';
import { crossPlatformTest } from '../../utils/cross_platform';
import { returnToConversationList } from '../../utils/cross_platform_actions';
import { friends } from '../../utils/cross_platform_state_builder';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';
import { MOVABLE_PRO_STATS } from '../../utils/pro_settings';

/**
 * A Pro subscriber's stats counters converge across her own linked clients. Runs three times, once per
 * client type performing the actions, so a failure names the client that produced them.
 *
 * Alice holds an Android, an iOS and a Desktop client; Bob is a recipient only. One of Alice's clients
 * sends an over-length message, sends a badged message and pins a conversation, and all three of her
 * clients — the one that acted and the two that only watched — must read the same +1 each time. This is
 * the claim the same-platform `pro_stats_usage` specs cannot make: they only ever read the counter back
 * on the client that moved it.
 *
 * Traps:
 * - Needs a REAL grant. Two of the three counters only move for a message that carried a Pro feature on
 *   the wire, and a display-level mock stamps no feature bits, so they would never move at all.
 * - Asserts DELTAS against a per-client baseline. Android recounts outgoing rows where iOS and Desktop
 *   bump a monotonic counter, so "+1 per action" is the only semantics all three share.
 * - The WHOLE reading every time, not just the cell expected to move. One send moving one counter by two
 *   is what the same-platform desktop spec caught (session-desktop #1998, the composing device counting
 *   its own synced copy back), and a per-cell assertion would have missed it.
 * - The two send counters and `pinned-conversations` converge by DIFFERENT mechanisms and can fail
 *   independently: a send is counted by each client as it receives a synced copy of the outgoing
 *   message, while the pin is a live count of a config-backed set.
 */

const LABEL: Record<ClientPlatform, string> = {
  android: 'Android',
  desktop: 'Desktop',
  ios: 'iOS',
};

/** Alice needs all three so two of them can watch whichever one acts; Bob is only somewhere to send. */
const ALICE_CLIENTS = { android: 1, desktop: 1, ios: 1 } as const;
const BOB_CLIENTS = { desktop: 1 } as const;

const LONG_MESSAGE = messageOfLength(OVER_STANDARD_CHARS);
const BADGED_MESSAGE = 'Badged';

/**
 * How long a client that did not act may take to agree with one that did.
 *
 * Generous because it covers a config sync or a synced message copy on a host holding four clients. If
 * these fail on the wait rather than on a wrong number, that is convergence — look at the product rather
 * than at this number.
 */
const STATS_SYNC_MAX_WAIT = 90_000;

crossPlatformTest({
  title: 'Pro stats moved on Android reach every linked client',
  risk: 'medium',
  isPro: true,
  setup: friends({ alice: ALICE_CLIENTS, bob: BOB_CLIENTS }),
  testCb: async ({ accounts: { alice, bob } }) => {
    await proStatsReachEveryLinkedClient({ alice, bob, actOn: 'android' });
  },
});

crossPlatformTest({
  title: 'Pro stats moved on iOS reach every linked client',
  risk: 'medium',
  isPro: true,
  setup: friends({ alice: ALICE_CLIENTS, bob: BOB_CLIENTS }),
  testCb: async ({ accounts: { alice, bob } }) => {
    await proStatsReachEveryLinkedClient({ alice, bob, actOn: 'ios' });
  },
});

crossPlatformTest({
  title: 'Pro stats moved on Desktop reach every linked client',
  risk: 'medium',
  isPro: true,
  setup: friends({ alice: ALICE_CLIENTS, bob: BOB_CLIENTS }),
  testCb: async ({ accounts: { alice, bob } }) => {
    await proStatsReachEveryLinkedClient({ alice, bob, actOn: 'desktop' });
  },
});

/** The stats a baseline reading should carry once `deltas` have been applied to it. */
function withDeltas(
  baseline: ProStatCounts,
  deltas: Partial<Record<MovableProStat, number>>
): ProStatCounts {
  const expected = { ...baseline };
  for (const stat of MOVABLE_PRO_STATS) {
    expected[stat] += deltas[stat] ?? 0;
  }
  return expected;
}

/**
 * Grant Alice Pro and leave every one of her clients knowing it.
 *
 * All three have to know: the stats matrix only renders for an active plan, so a client that has not
 * seen the grant cannot be read at all. The client that minted observes it directly — that screen fetches
 * on mount, which is the only route that works — and the other two wait on the fetch-free settings-root
 * signal instead, so they are not racing the proof the actor just bought with a `get_pro_status` of their
 * own.
 */
async function makeAlicePro(alice: AccountClients, actOn: ClientPlatform): Promise<void> {
  await test.step(`${alice.account.userName} subscribes to Pro on ${LABEL[actOn]}`, async () => {
    if (actOn === 'desktop') {
      const subscriber = alice.desktop[0];
      await subscriber.subscribeToPro(alice.account);
      await subscriber.waitForProActive();
      return;
    }
    const subscriber = alice[actOn][0];
    await subscriber.subscribeToPro(alice.account);
    await observeProGrant(subscriber);
  });
}

async function turnOnProBadge(alice: AccountClients, actOn: ClientPlatform): Promise<void> {
  if (actOn === 'desktop') {
    await alice.desktop[0].enableProBadge();
    return;
  }
  await enableProBadge(alice[actOn][0], actOn);
}

/**
 * Assert every client's reading, actor first.
 *
 * The actor is asserted from a single reading: its action completed locally, so a wrong number there is
 * wrong now rather than late. Every other client is re-read until it agrees, because it learns of the
 * action asynchronously — a synced copy of the message for the two send counters, a config change for
 * the pinned one. The final assertion is unconditional either way, so a client that settles on the wrong
 * number still fails with the number it settled on.
 */
async function expectEveryClientReads(
  readings: ReadonlyArray<{ client: IBaseDeviceWrapper; baseline: ProStatCounts }>,
  actor: IBaseDeviceWrapper,
  deltas: Partial<Record<MovableProStat, number>>
): Promise<void> {
  for (const { client, baseline } of readings) {
    const expected = withDeltas(baseline, deltas);
    await test.step(`${client.getDeviceIdentity()} reads ${JSON.stringify(expected)}`, async () => {
      let reading = await client.readProStats();
      if (client !== actor) {
        const deadline = Date.now() + STATS_SYNC_MAX_WAIT;
        while (
          Date.now() < deadline &&
          MOVABLE_PRO_STATS.some(stat => reading[stat] !== expected[stat])
        ) {
          reading = await client.readProStats();
        }
      }
      expect(reading).toEqual(expected);
    });
  }
}

async function proStatsReachEveryLinkedClient({
  alice,
  bob,
  actOn,
}: {
  alice: AccountClients;
  bob: AccountClients;
  actOn: ClientPlatform;
}): Promise<void> {
  const bobName = bob.account.userName;
  const actor = alice[actOn][0];
  // Reference identity, not platform names: `clients` holds the very same wrapper instances the
  // per-platform arrays do. Actor first so the source-side reading is what fails when the action itself
  // did not happen.
  const clients = [actor, ...alice.clients.filter(client => client !== actor)];

  await makeAlicePro(alice, actOn);

  await test.step(`Pro reaches ${alice.account.userName}'s other clients`, async () => {
    for (const observer of clients.slice(1)) {
      await observer.waitForOwnProBadge();
    }
  });

  // Read rather than assumed to be zero, per client: the claim is the delta, and the three clients do
  // not agree on what an absolute reading means.
  const readings = [];
  for (const client of clients) {
    readings.push({ client, baseline: await client.readProStats() });
  }

  await test.step(`Send a ${OVER_STANDARD_CHARS}-character message from ${LABEL[actOn]}`, async () => {
    await actor.openConversationWith(bobName);
    // Waits for the sent tick, which is what separates a send from a refusal: an over-length message a
    // non-Pro client will not send raises a modal and never ticks.
    await actor.sendMessage(LONG_MESSAGE);
    await returnToConversationList(actor);
  });

  // The badge is still off, so this send carried the increased-length feature and nothing else.
  await expectEveryClientReads(readings, actor, { 'longer-messages': 1 });

  await turnOnProBadge(alice, actOn);

  await test.step(`Send one short message from ${LABEL[actOn]} with the badge on`, async () => {
    await actor.openConversationWith(bobName);
    await actor.sendMessage(BADGED_MESSAGE);
    await returnToConversationList(actor);
  });

  // Short, so it carries the badge and not the length feature — the mirror image of the send above, and
  // together they say the two cells read different bits on every client rather than the same one twice.
  await expectEveryClientReads(readings, actor, { 'badges-sent': 1, 'longer-messages': 1 });

  await test.step(`Pin ${bobName} on ${LABEL[actOn]}`, async () => {
    await actor.pinConversation(bobName);
  });

  await expectEveryClientReads(readings, actor, {
    'badges-sent': 1,
    'longer-messages': 1,
    'pinned-conversations': 1,
  });
}
