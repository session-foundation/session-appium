import { test } from '@playwright/test';

import type { ProMessageFeature } from '../../utils/pro_message_features';

import { crossPlatformTest } from '../../utils/cross_platform';
import { restartClient } from '../../utils/cross_platform_actions';
import { friends } from '../../utils/cross_platform_state_builder';
import { enableProBadge } from '../../utils/pro_badge';

/**
 * Cross-platform Session Pro: subscribe on one client, use Pro from a linked one, and have every
 * other client render the result.
 *
 * Alice and Bob are seeded as friends, each with an Android, an iOS and a Desktop client. Alice
 * subscribes from Android against the QA Pro backend; her Desktop client — which never subscribed
 * and is never restarted — then sends a message only a Pro account can send, and all six clients
 * are checked.
 *
 * All three client types at once is the point rather than a bigger number of devices: the proof is
 * minted by one implementation and read back by the other two, so a verification regression on any
 * single client fails here even though every pairwise spec still passes. Alice's iOS client is a
 * second *linked* device alongside Desktop, and Bob's iOS client is a third independent verifier of
 * her proof.
 *
 * This is one of the few Pro assertions that needs a real grant rather than the launch-arg mocks:
 * the mocks are display-level and per-device, so they convince one client and produce no proof for
 * anyone else to verify. Every step below turns on something only a real proof can do — a linked
 * device inheriting the entitlement, and a peer verifying the badge.
 *
 * Cost: the most expensive spec in the suite — 2 iOS simulators, 2 Android emulators and 2 Electron
 * windows held simultaneously. `assertPoolsCanFit` refuses the run before the (slow) seeding step if
 * the machine has fewer, so this needs `DEVICES_PER_TEST_COUNT >= 2` (locally the default is 4) and
 * at least 2 emulators in the Android udid pool. Desktop is uncapped — each window gets its own
 * `NODE_APP_INSTANCE`.
 */

// Over the standard 2000-char cap, which is the Pro gate: a non-Pro account's send is blocked by the
// "longer messages" upgrade CTA, so the message never reaches 'sent'.
//
// Asserted in FULL on every client, never by its prefix. Mobile's text matcher compares the *whole*
// element text (`findMatchingTextInElementArray` normalises then `===`), so a marker-only assertion
// fails against a message body that is present and correct — which reads as a sync failure. Desktop's
// `:has-text()` is a substring match and accepts either, so the full string is the one both take.
const PRO_MESSAGE = `pro-sync-marker ${'x'.repeat(2001)}`;

// What that message should be recorded as having used: the longer-message allowance it needed, and the
// badge Alice turned on. Both are per-message, and both require a valid proof to appear.
const EXPECTED_PRO_FEATURES: ProMessageFeature[] = ['increasedMessageLength', 'proBadge'];

crossPlatformTest({
  title: 'Pro subscription syncs to a linked device and its message shows for every client',
  risk: 'high',
  isPro: true,
  setup: friends({
    // Bob gets the iOS client, Alice does not, and that asymmetry is deliberate.
    //
    // The two things this spec proves need different devices: a RECIPIENT on a third client
    // type (Bob's iOS, which must verify Alice's proof) and a LINKED device inheriting the
    // entitlement (Alice's desktop, which already does that). Alice's own iOS client adds
    // neither -- and it measurably costs: with it, `assertSenderProBadge` on Bob's clients
    // times out at 60s twice in a row, while the badge is verifiably present in the page
    // source captured moments later. Load is not the cause (4.5 on a 14-core host); a third
    // linked device on Alice appears to push badge convergence past the wait.
    //
    // Worth a product look rather than a longer timeout -- if three linked devices really
    // do slow profile convergence past a minute, a real user sees that too.
    alice: { android: 1, desktop: 1 },
    bob: { android: 1, ios: 1, desktop: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    const aliceName = alice.account.userName;
    const bobName = bob.account.userName;
    const [aliceAndroid] = alice.android;
    const [aliceDesktop] = alice.desktop;

    await test.step(`${aliceName} subscribes to Pro on her Android client`, async () => {
      // Mints a payment through the backend's dev route and binds it to the Pro master key derived
      // from Alice's recovery phrase — so it grants the account under test, not a lookalike.
      await aliceAndroid.subscribeToPro(alice.account);
      // The grant is only observed on a fresh launch: the client reads its Pro status at startup.
      await restartClient(aliceAndroid, { pro: true });
    });

    // Being Pro is not the same as advertising it: badge visibility is a separate per-user setting,
    // off by default, and every badge assertion below depends on it. It doubles as Alice's local Pro
    // check — the toggle is guarded on a proof existing, so it cannot be set on a non-Pro account.
    await enableProBadge(aliceAndroid, 'android');

    await test.step(`Pro synced to ${aliceName}'s linked desktop`, async () => {
      // The Desktop client never subscribed and is deliberately NOT restarted: it inherits both the
      // entitlement and the badge flag through config sync.
      //
      // Waited on BEFORE sending, not asserted after: the badge is a per-user profile flag, so a
      // message composed here before it arrives goes out without the PRO_BADGE feature. Every badge
      // assertion below would then fail on receivers that are behaving correctly — and it would fail
      // intermittently, on sync timing.
      //
      // This wait must not reach the Pro settings page. Opening it fires `get_pro_status` on mount, so
      // a poll loop there turns this linked device into a second client minting against Alice's
      // account, racing the proof the subscribing client just obtained. Only the subscriber (her
      // Android, via `enableProBadge` above) goes near that screen — neither of her linked devices,
      // Desktop nor iOS, is ever sent there, which is also why her iOS client has no wait of its own:
      // the fetch-free "own Pro badge" check `waitForOwnProBadge` performs exists on Desktop only.
      await aliceDesktop.waitForOwnProBadge();
      // The send is the entitlement assertion: >2000 chars is Pro-gated, so a non-Pro client is
      // blocked by the upgrade CTA. It retries until the proof lands rather than asserting at once.
      await aliceDesktop.sendLongProMessage(bobName, PRO_MESSAGE);
    });

    await test.step('Verify the Pro message on every client', async () => {
      // Every client is an independent session/window, so all six are checked at once.
      await Promise.all([
        // Alice's own devices: the Pro message converged across her linked clients. No badge to
        // assert here — her clients show BOB in the header, and a 1:1 header carries the badge of
        // the person the conversation is *with*, never the local user's own.
        ...alice.clients.map(async client => {
          await client.openConversationWith(bobName);
          await client.waitForMessage(PRO_MESSAGE);
        }),
        // Bob's devices: the message AND Alice's badge. Rendering the badge means this client
        // verified her proof against the QA backend's signing key, which is the end-to-end check —
        // performed here by three separate implementations of that verification.
        ...bob.clients.map(async client => {
          await client.assertSenderProBadge(aliceName);
          await client.waitForMessage(PRO_MESSAGE);
        }),
      ]);
    });

    await test.step('Verify the message records both Pro features on every client', async () => {
      // The strongest form of the check: not "the sender is Pro" but "this message was sent with
      // exactly these Pro features". Asserted on ALL SIX clients — Alice's three because the record
      // has to survive linked-device sync, Bob's three because that is where it was verified from a
      // proof rather than from local knowledge.
      await Promise.all(
        [...alice.clients, ...bob.clients].map(client =>
          client.assertMessageProFeatures(PRO_MESSAGE, EXPECTED_PRO_FEATURES)
        )
      );
    });
  },
});
