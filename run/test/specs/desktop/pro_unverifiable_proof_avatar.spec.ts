import { resolve } from 'path';

import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS, UNTRUSTED_PRO_BACKEND_KEY } from '../../../shared/constants';

const ANIMATED_AVATAR = resolve(__dirname, '../../media/animated_profile_picture.gif');

const SENT_WITH_FAKE_PROOF = 'Sent with a fake proof';

// Verified as a matched pair: with this left undefined — recipient on the real key — the avatar DOES
// animate for the recipient (22s), so a still one here is the client refusing a feature whose proof it
// cannot verify, not a fixture that never produced an animation.
const RECIPIENT_BACKEND_KEY: string | undefined = UNTRUSTED_PRO_BACKEND_KEY;

/**
 * The animated display picture half of "a recipient does not honour a proof it cannot verify".
 *
 * The badge spec covers the same refusal for `proBadge`; this covers the animated avatar, which is a
 * PROFILE feature and travels with a message rather than being fetched. Separate specs per feature so a
 * client that wrongly honours one and correctly refuses the other is identifiable from the results.
 *
 * A real grant, not a mock: `setAnimatedAvatar` is written to libSession config and the display mocks
 * write no config, so a mocked subscriber uploads an animated picture that never renders as one.
 *
 * 🔴 The freeze is not instantaneous. Observed on Android: the picture animates for a frame or two and
 * then stops. So the settle before sampling guards BOTH directions — shortening it would catch those
 * opening frames and fail a client that is refusing correctly.
 */
test_Alice_1W_Bob_1W_friends(
  'A recipient does not animate a display picture it cannot verify',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await restartApp(alice, { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR });
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    // Sender-side control: the picture really is animated here, so a still one at the recipient is the
    // recipient's decision rather than a fixture that never produced an animation.
    await alice.verifyOwnAvatarAnimated();

    // Only the recipient's trust changes, and before the message: verification happens at receipt.
    await restartApp(bob, {
      ...(RECIPIENT_BACKEND_KEY
        ? { pro: { proBackendPubkey: RECIPIENT_BACKEND_KEY } }
        : { pro: {} }),
    });

    // The avatar rides along with a message rather than arriving on its own.
    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_WITH_FAKE_PROOF);

    // The relaunch left this window on the conversation LIST, and `waitForMessage` only watches the
    // OPEN conversation.
    await bob.openConversationWith(alice.userName);
    await bob.waitForMessage(SENT_WITH_FAKE_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);

    await bob.verifySenderAvatarNotAnimated(alice.userName);
  },
  { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR }
);
