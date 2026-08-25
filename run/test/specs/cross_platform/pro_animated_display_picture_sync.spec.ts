import { test } from '@playwright/test';

import { crossPlatformTest } from '../../utils/cross_platform';
import { friends } from '../../utils/cross_platform_state_builder';
import { observeProGrant } from '../../utils/pro_refresh';

/**
 * Cross-platform animated display picture: a Pro user sets one on ONE client type, and a DIFFERENT
 * client type renders it as an animation rather than a still frame.
 *
 * This is the cross-platform counterpart to coverage that already exists same-platform on all three
 * clients — `specs/desktop/pro_animated_display_picture.spec.ts` and
 * `specs/mobile/user_actions_animated_profile_picture.spec.ts`. Those prove a client can upload one
 * and that a peer of the SAME client type animates it. Neither can fail when the two clients
 * disagree about the wire format, the config field or the Pro gate, which is the interesting case:
 * the picture is written to libSession config by the sender and re-decided by the receiver, so
 * "animated" is a property each client computes for itself.
 *
 * Alice sets the picture on Android. Two other clients then have to arrive at "animate this":
 *
 *   - her own linked DESKTOP, which never saw the upload and learns both the picture and the
 *     entitlement through config sync (`assertOwnAvatarAnimated`);
 *   - BOB's desktop, which learns the picture over the network from a peer and must verify Alice's
 *     Pro proof before it is allowed to animate it (`assertSenderAvatarAnimated`).
 *
 * Direction note: only mobile → desktop is exercised, and that is a harness limit rather than a
 * choice. Desktop's uploader depends on `fakeAvatarPickerFile`, a launch-time context the
 * cross-platform opener does not thread through today (it launches windows with `{ pro: {} }` and
 * nothing else), so a desktop client in this suite cannot pick an animated file at all. Wiring that
 * through is what the reverse direction needs.
 *
 * ## Real grant, not a mock
 *
 * This needs a REAL Pro grant on Alice, on both counts a mock would have to cover:
 *
 *   - the upload itself is Pro-gated — a non-Pro account picking an animated image gets the upsell
 *     CTA instead of an upload (that is the `(non Pro)` case in the same-platform specs); and,
 *     decisively,
 *   - the RECEIVING clients each decide for themselves whether the sender may animate. The display
 *     mocks are per-device and write no config and no proof, so a mocked subscriber uploads a
 *     picture that every other client renders as its first frame — `freezeFrameForUser` on mobile,
 *     the equivalent on desktop. A mock convinces the client it is set on and nobody else, and here
 *     two OTHER clients are the assertion.
 *
 * So Alice buys one through the QA Pro backend and restarts, exactly as `pro_message_sync` does.
 * Her desktop is deliberately NOT restarted: it has to inherit the entitlement through config sync,
 * which is half of what the linked-device assertion is proving.
 *
 * ## What makes this able to fail
 *
 * `assertOwnAvatarAnimated` / `assertSenderAvatarAnimated` both sample one pixel repeatedly and
 * require more than one distinct colour, so a still frame and a never-loaded avatar are each a
 * single colour and each fail — the assertion is not satisfied by the picture merely being there.
 * On mobile the two are told apart by name (the generated-avatar palette is recognised and reported
 * as "never loaded" rather than "not animated"); desktop reports one failure for both.
 *
 * Two controls sit either side of that:
 *
 *   - Alice's Android asserts her own avatar animated immediately after the upload. If that fails,
 *     the upload never produced an animation and nothing downstream is worth reading — which is a
 *     different bug, with a different owner, from the cross-platform renders failing.
 *   - each observing client waits for Alice's MESSAGE before looking at her avatar. A profile rides
 *     along with messages, so the message arriving is what makes "the avatar is still a placeholder"
 *     mean something. Without it a frozen avatar and a client that received nothing at all are
 *     indistinguishable.
 */

// Short and asserted in full: mobile's matcher compares the WHOLE element text
// (`findMatchingTextInElementArray` normalises then `===`), so there is no room for a prefix here.
const MESSAGE = 'Animated display picture set on Android';

crossPlatformTest({
  title: 'Animated display picture set on one client shows animated on another',
  risk: 'high',
  isPro: true,
  setup: friends({
    // One uploader (Android) and two observers of the OTHER client type: Alice's own linked desktop
    // and Bob's. Bob gets no mobile client on purpose — an Android peer would be the same-platform
    // case the mobile spec already covers, at the price of a second emulator.
    alice: { android: 1, desktop: 1 },
    bob: { desktop: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    const aliceName = alice.account.userName;
    const bobName = bob.account.userName;
    const [aliceAndroid] = alice.android;
    const [aliceDesktop] = alice.desktop;
    const [bobDesktop] = bob.desktop;

    await test.step(`${aliceName} subscribes to Pro on her Android client`, async () => {
      // Mints a payment through the backend's dev route and binds it to the Pro master key derived
      // from Alice's recovery phrase, so it grants the account under test rather than a lookalike.
      await aliceAndroid.subscribeToPro(alice.account);
      // A restart is NOT enough, and this failed exactly that way before: the upload hit the
      // non-Pro upsell CTA, which then covered the screen and the next step died looking for
      // "User settings". Each client gates its cold-launch `get_pro_status` on already knowing
      // it has access, so an account that has never seen a grant is never fetched for and stays
      // non-Pro however many times it relaunches. Opening Pro settings fetches regardless, which
      // is what `observeProGrant` does — and it restarts first, so it subsumes the restart.
      //
      // Only the SUBSCRIBER may do this. Alice's desktop must not: a linked device opening that
      // screen fires its own `get_pro_status` and races the proof the subscriber just minted.
      await observeProGrant(aliceAndroid);
    });

    await test.step(`${aliceName} sets an animated display picture on Android`, async () => {
      // Mobile-specific by necessity: the animated-vs-still choice is an argument here, whereas
      // desktop picks whatever its launch context configured. Nothing neutral to promote yet.
      await aliceAndroid.uploadProfilePicture(true);
      // Source-side control. Passing here means the upload really produced an animation on the
      // client that performed it, so a failure further down is about the OTHER client type.
      await aliceAndroid.assertOwnAvatarAnimated();
    });

    await test.step(`${aliceName} messages ${bobName} from Android`, async () => {
      // The carrier: a profile (display picture included) rides along with messages, so this is what
      // hands Bob's client something to render, and what gives both observers a control to wait on.
      await aliceAndroid.openConversationWith(bobName);
      await aliceAndroid.sendMessage(MESSAGE);
    });

    // Sequential rather than under `Promise.all`: the two observers are independent windows and
    // could be checked at once, but the sampler's failure names a selector and not a client, so a
    // step per observer is the only thing that says WHICH one did not animate.
    await test.step(`${aliceName}'s linked desktop renders her own picture animated`, async () => {
      // Her desktop never saw the upload and is never restarted: the picture and the entitlement
      // both have to arrive by config sync for this to pass.
      await aliceDesktop.openConversationWith(bobName);
      await aliceDesktop.waitForMessage(MESSAGE);
      await aliceDesktop.assertOwnAvatarAnimated();
    });

    await test.step(`${bobName}'s desktop renders ${aliceName}'s picture animated`, async () => {
      // The end-to-end case: a different client type, a different account, and a Pro proof that had
      // to be verified here before this avatar was allowed to move.
      await bobDesktop.openConversationWith(aliceName);
      await bobDesktop.waitForMessage(MESSAGE);
      await bobDesktop.assertSenderAvatarAnimated(aliceName);
    });
  },
});
