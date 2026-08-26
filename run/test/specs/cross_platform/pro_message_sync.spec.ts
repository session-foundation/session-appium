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
 * Alice and Bob are seeded as friends, each with an Android and a Desktop client. Alice subscribes
 * from Android against the QA Pro backend; her Desktop client — which never subscribed and is never
 * restarted — then sends a message only a Pro account can send, and all four clients are checked.
 *
 * This is one of the few Pro assertions that needs a real grant rather than the launch-arg mocks:
 * the mocks are display-level and per-device, so they convince one client and produce no proof for
 * anyone else to verify. Every step below turns on something only a real proof can do — a linked
 * device inheriting the entitlement, and a peer verifying the badge.
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
    alice: { android: 1, desktop: 1 },
    bob: { android: 1, desktop: 1 },
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
      // Android, via `enableProBadge` above) goes near that screen.
      await aliceDesktop.waitForOwnProBadge();
      // The send is the entitlement assertion: >2000 chars is Pro-gated, so a non-Pro client is
      // blocked by the upgrade CTA. It retries until the proof lands rather than asserting at once.
      await aliceDesktop.sendLongProMessage(bobName, PRO_MESSAGE);
    });

    await test.step('Verify the Pro message on every client', async () => {
      // Every client is an independent session/window, so all four are checked at once.
      await Promise.all([
        // Alice's own devices: the Pro message converged across her linked clients. No badge to
        // assert here — her clients show BOB in the header, and a 1:1 header carries the badge of
        // the person the conversation is *with*, never the local user's own.
        ...alice.clients.map(async client => {
          await client.openConversationWith(bobName);
          await client.waitForMessage(PRO_MESSAGE);
        }),
        // Bob's devices: the message AND Alice's badge. Rendering the badge means this client
        // verified her proof against the QA backend's signing key, which is the end-to-end check.
        ...bob.clients.map(async client => {
          await client.assertConversationHeaderProBadge(aliceName);
          await client.waitForMessage(PRO_MESSAGE);
        }),
      ]);
    });

    await test.step('Verify the message records both Pro features on every client', async () => {
      // The strongest form of the check: not "the sender is Pro" but "this message was sent with
      // exactly these Pro features". Asserted on ALL FOUR clients — Alice's two because the record
      // has to survive linked-device sync, Bob's two because that is where it was verified from a
      // proof rather than from local knowledge.
      await Promise.all(
        [...alice.clients, ...bob.clients].map(client =>
          client.assertMessageProFeatures(PRO_MESSAGE, EXPECTED_PRO_FEATURES)
        )
      );
    });
  },
});
