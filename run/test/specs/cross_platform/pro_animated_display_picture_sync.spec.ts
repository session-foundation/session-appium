import { test } from '@playwright/test';
import { resolve } from 'path';

import type { AccountClients } from '../../utils/cross_platform';

import { animatedProfilePicture, mediaFolder } from '../../../constants/testfiles';
import { crossPlatformTest } from '../../utils/cross_platform';
import { friends } from '../../utils/cross_platform_state_builder';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';

/**
 * Cross-platform animated display picture: a Pro user sets one on ONE client type, and every OTHER
 * client renders it as an animation rather than a still frame.
 *
 * This is the cross-platform counterpart to coverage that already exists same-platform on all three
 * clients — `specs/desktop/pro_animated_display_picture.spec.ts` and
 * `specs/mobile/user_actions_animated_profile_picture.spec.ts`. Those prove a client can upload one
 * and that a peer of the SAME client type animates it. Neither can fail when two clients disagree
 * about the wire format, the config field or the Pro gate, which is the interesting case: the
 * picture is written to libSession config by the sender and re-decided by the receiver, so
 * "animated" is a property each client computes for itself.
 *
 * ## Three variants, because the uploader is the variable
 *
 * The same body runs three times, once per client type performing the change, and each run puts
 * TWO kinds of observer on the other side of it:
 *
 *   - Alice's own LINKED devices on the two remaining platforms, which never saw the upload and
 *     learn both the picture and the entitlement through config sync (`assertSettingsAvatarAnimated`);
 *   - BOB, on a client type different from the uploader's, who learns the picture over the network
 *     from a peer and must verify Alice's Pro proof before he is allowed to animate it — read off
 *     his conversation header, which in a 1:1 always draws the other person
 *     (`assertConversationHeaderAvatarAnimated`).
 *
 * So Alice holds all three client types in every variant, and Bob holds exactly one — rotated so
 * that across the three registrations every client type is exercised as the peer receiver too. Bob
 * is deliberately not given three of his own: his second and third clients would re-assert the
 * receiver path the other variants already cover, at the price of standing up six clients at once,
 * which is measurably where this hardware starts failing on propagation timeouts rather than on CPU.
 *
 * The desktop variant used to be impossible, and it is worth knowing why it is not any more: desktop
 * has no file dialog to drive under test integration, so the image its picker returns is fixed at
 * LAUNCH by `fakeAvatarPickerFile` — which the cross-platform opener did not thread through. It now
 * does, which is the only reason a desktop client here can pick an animated file at all.
 *
 * ## Real grant, not a mock
 *
 * This needs a REAL Pro grant on Alice, on both counts a mock would have to cover:
 *
 *   - the upload itself is Pro-gated — a non-Pro account picking an animated image gets the upsell
 *     CTA instead of an upload (that is the `(non Pro)` case in the same-platform specs); and,
 *     decisively,
 *   - the OBSERVING clients each decide for themselves whether the account may animate. The display
 *     mocks are per-device and write no config and no proof, so a mocked subscriber uploads a
 *     picture that every other client renders as its first frame — `freezeFrameForUser` on mobile,
 *     the equivalent on desktop. A mock convinces the client it is set on and nobody else, and here
 *     three OTHER clients are the assertion.
 *
 * ## What makes this able to fail
 *
 * `assertSettingsAvatarAnimated` and `assertConversationHeaderAvatarAnimated` both sample one pixel
 * repeatedly and require more than one distinct colour, so a still frame and a never-loaded avatar
 * are each a single colour and each fail — the assertion is not satisfied by the picture being there.
 * On mobile the two are told apart by name (the generated-avatar palette is recognised and reported
 * as "never loaded" rather than "not animated", because an upload that never propagated is a
 * different bug, with a different owner, from a picture the receiver refused to animate); desktop
 * reports one failure for both.
 *
 * Two controls sit either side of that:
 *
 *   - the uploader asserts its OWN avatar animated immediately after the upload. If that fails, the
 *     upload never produced an animation and nothing downstream is worth reading.
 *   - every observer waits for Alice's MESSAGE before looking at her avatar. A profile rides along
 *     with messages, so the message arriving is what makes "the avatar is still a placeholder" mean
 *     something. Without it a frozen avatar and a client that received nothing at all are
 *     indistinguishable.
 */

/** The three client types, as the spec's own vocabulary for "who performs the change". */
type ClientType = 'android' | 'desktop' | 'ios';

const LABEL: Record<ClientType, string> = {
  android: 'Android',
  desktop: 'Desktop',
  ios: 'iOS',
};

/**
 * The image every desktop window's picker returns.
 *
 * Desktop is the one client that cannot be told WHICH image at call time: under test integration
 * its picker never opens a file dialog and hands back whatever this named at launch, defaulting to
 * a generated solid-colour JPEG. Mobile picks the same file from the device's own gallery.
 */
const ANIMATED_AVATAR = resolve(mediaFolder, animatedProfilePicture);

/** Alice holds every client type in every variant — one of them uploads, the rest observe. */
const ALICE_ON_EVERY_PLATFORM = { android: 1, desktop: 1, ios: 1 } as const;

crossPlatformTest({
  title: 'Animated display picture set on Android shows animated on every other client',
  risk: 'high',
  isPro: true,
  setup: friends({
    alice: ALICE_ON_EVERY_PLATFORM,
    bob: { desktop: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    await animatedPictureReachesEveryClient({ alice, bob, uploadOn: 'android' });
  },
});

crossPlatformTest({
  title: 'Animated display picture set on iOS shows animated on every other client',
  risk: 'high',
  isPro: true,
  setup: friends({
    alice: ALICE_ON_EVERY_PLATFORM,
    bob: { android: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    await animatedPictureReachesEveryClient({ alice, bob, uploadOn: 'ios' });
  },
});

crossPlatformTest({
  title: 'Animated display picture set on Desktop shows animated on every other client',
  risk: 'high',
  isPro: true,
  setup: friends({
    alice: ALICE_ON_EVERY_PLATFORM,
    bob: { ios: 1 },
  }),
  // Only this variant needs it, and only Alice's window uses it — but it is a process env var read
  // at launch, so every desktop window in this test gets it. A window that never opens the picker is
  // unaffected. Without it `setAnimatedDisplayPicture` throws rather than quietly uploading a still.
  fakeAvatarPickerFile: ANIMATED_AVATAR,
  testCb: async ({ accounts: { alice, bob } }) => {
    await animatedPictureReachesEveryClient({ alice, bob, uploadOn: 'desktop' });
  },
});

/**
 * Give Alice a real Pro grant, and leave the client that is about to upload believing it.
 *
 * Two shapes, because "which client knows it is Pro" is not the same question as "which account is
 * Pro", and only the uploader's belief gates the upload.
 */
async function makeUploaderPro(alice: AccountClients, uploadOn: ClientType): Promise<void> {
  const aliceName = alice.account.userName;

  if (uploadOn !== 'desktop') {
    await test.step(`${aliceName} subscribes to Pro on her ${LABEL[uploadOn]} client`, async () => {
      const subscriber = alice[uploadOn][0];
      // Mints a payment through the backend's dev route and binds it to the Pro master key derived
      // from Alice's recovery phrase, so it grants the account under test rather than a lookalike.
      await subscriber.subscribeToPro(alice.account);
      // A restart is NOT enough, and this failed exactly that way before: the upload hit the
      // non-Pro upsell CTA, which then covered the screen and the next step died looking for
      // "User settings". Each client gates its cold-launch `get_pro_status` on already knowing
      // it has access, so an account that has never seen a grant is never fetched for and stays
      // non-Pro however many times it relaunches. Opening Pro settings fetches regardless, which
      // is what `observeProGrant` does — and it restarts first, so it subsumes the restart.
      //
      // Only the SUBSCRIBER may do this. Alice's other clients must not: a linked device opening
      // that screen fires its own `get_pro_status` and races the proof the subscriber just minted.
      await observeProGrant(subscriber);
    });
    return;
  }

  // Desktop cannot mint and then notice it: `subscribeToPro` on the window that has to observe the
  // result would still need a restart, since a client reads its Pro status at startup. A LINKED
  // device does not — it receives the proof through config sync — so the grant is bought on mobile
  // and the desktop window simply waits for it to arrive, with no relaunch anywhere.
  const [subscriber] = alice.android;
  await test.step(`${aliceName} subscribes to Pro on her Android client`, async () => {
    await subscriber.subscribeToPro(alice.account);
    await observeProGrant(subscriber);
    // The badge flag is what the desktop window can watch for without going near the Pro settings
    // screen, which is the one page that would fire its own `get_pro_status`. It is a separate
    // per-user setting, off by default, and writable only against a proof — so turning it on here
    // and seeing it there is a config-sync signal that a non-Pro account could not produce.
    await enableProBadge(subscriber, 'android');
  });

  await test.step(`Pro reaches ${aliceName}'s linked Desktop client`, async () => {
    // Waited for BEFORE the upload rather than asserted after it: a desktop client that opens the
    // picker before the entitlement lands is shown the upsell CTA instead, and `uploadProfilePicture`
    // treats that as a legitimate outcome — so the picture would silently never be set.
    await alice.desktop[0].waitForOwnProBadge();
  });
}

async function animatedPictureReachesEveryClient({
  alice,
  bob,
  uploadOn,
}: {
  alice: AccountClients;
  bob: AccountClients;
  uploadOn: ClientType;
}): Promise<void> {
  const aliceName = alice.account.userName;
  const bobName = bob.account.userName;
  const uploader = alice[uploadOn][0];
  // Everything of Alice's that did NOT perform the change. Reference identity, not platform names:
  // `clients` holds the very same wrapper instances the per-platform arrays do.
  const linkedObservers = alice.clients.filter(client => client !== uploader);
  const [bobClient] = bob.clients;

  // Short and asserted in full: mobile's matcher compares the WHOLE element text
  // (`findMatchingTextInElementArray` normalises then `===`), so there is no room for a prefix here.
  const message = `Animated display picture set on ${LABEL[uploadOn]}`;

  await makeUploaderPro(alice, uploadOn);

  await test.step(`${aliceName} sets an animated display picture on ${LABEL[uploadOn]}`, async () => {
    await uploader.setAnimatedDisplayPicture();
    // Source-side control. Passing here means the upload really produced an animation on the client
    // that performed it, so a failure further down is about the OTHER clients.
    await uploader.assertSettingsAvatarAnimated();
  });

  await test.step(`${aliceName} messages ${bobName} from ${LABEL[uploadOn]}`, async () => {
    // The carrier: a profile (display picture included) rides along with messages, so this is what
    // hands Bob's client something to render, and what gives every observer a control to wait on.
    //
    // Opened AFTER the upload, unlike the desktop-only spec, which opens first because setting an
    // avatar re-sorts the conversation list for a while and a row that is still moving is not
    // clickable. Safe here because the own-avatar assertion above sits in between and samples for
    // seconds, and because the click auto-waits for the row to settle rather than failing on it.
    await uploader.openConversationWith(bobName);
    await uploader.sendMessage(message);
  });

  // Sequential rather than under `Promise.all`: the observers are independent sessions and could be
  // checked at once, but the sampler's failure names an element and not a client, so a step per
  // observer is the only thing that says WHICH one did not animate. It also keeps the mobile clients
  // from driving settings navigations against each other on a contended host.
  for (const observer of linkedObservers) {
    const where = observer.getDeviceIdentity();
    await test.step(`${where} renders ${aliceName}'s own picture animated`, async () => {
      // This client never saw the upload and is never restarted: the picture and the entitlement
      // both have to arrive by config sync for this to pass.
      await observer.openConversationWith(bobName);
      await observer.waitForMessage(message);
      await observer.assertSettingsAvatarAnimated();
    });
  }

  const bobWhere = bobClient.getDeviceIdentity();
  await test.step(`${bobWhere} renders ${aliceName}'s picture animated`, async () => {
    // The end-to-end case: a different client type, a different account, and a Pro proof that had
    // to be verified here before this avatar was allowed to move.
    await bobClient.openConversationWith(aliceName);
    await bobClient.waitForMessage(message);
    await bobClient.assertConversationHeaderAvatarAnimated(aliceName);
  });
}
