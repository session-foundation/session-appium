import { resolve } from 'path';

import { animatedProfilePicture, mediaFolder } from '../../../constants/testfiles';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { revokeAccountPro } from '../../../shared/pro_grant';
import {
  DESKTOP_PRO_CONTEXT,
  SENT_ON_NEW_PROOF,
  SENT_ON_OLD_PROOF,
} from '../../../shared/pro_revocation';

const ANIMATED_AVATAR = resolve(mediaFolder, animatedProfilePicture);

/**
 * The desktop half of "an animated display picture survives a proof rotation", and the half that can
 * actually reproduce the observation behind it: a manual pass recorded, **on Desktop**, that a standard
 * user sees another Pro user's animated profile picture — "(not after renewal)".
 *
 * "Animated" is not a property of the picture on the wire. Each client recomputes it from the sender's
 * proof and freezes the frame when the gate is not satisfied, so a display picture is only as animated as
 * the recipient's copy of the sender's credential is live. That makes it the one Pro surface where a
 * stale credential is silent — a frozen animation is an ordinary still picture, and nobody reports one.
 *
 * A rotation stands in for a renewal because it is what the harness can drive, and it leaves a recipient
 * in the same state: an entitlement that is still valid and a proof in someone else's hands that is not.
 *
 * The mobile pair asserts the same three things; this one exists separately because the freeze is a
 * per-client rendering decision, so a client that gets it wrong is only visible in its own column.
 */
test_Alice_1W_Bob_1W_friends(
  'An animated display picture survives a proof rotation',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    // Desktop asks the backend for status only at startup, so the grant is invisible until restart.
    await restartApp(alice, { ...DESKTOP_PRO_CONTEXT, fakeAvatarPickerFile: ANIMATED_AVATAR });
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    // Sender-side control: the fixture really does animate, so a still frame later is a decision rather
    // than a picture that never moved.
    await alice.assertSettingsAvatarAnimated();

    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_ON_OLD_PROOF);
    await bob.waitForMessage(SENT_ON_OLD_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);
    // The positive control, and the reason the freeze below means anything: without it, a spec asserting
    // a still frame passes against a picture that never animated for this recipient at all.
    await bob.assertConversationHeaderAvatarAnimated(alice.userName);

    // `revokePayments: false` is a rotation rather than a refund. The helper refuses to continue if the
    // backend allocated no replacement, so a rotation behaving like a refund fails here.
    await revokeAccountPro({
      user: alice.getUser(),
      revokePayments: false,
      effectiveInSeconds: 0,
    });

    // Alice only drops a revoked proof at her next poll, which the relaunch forces.
    await restartApp(alice, { ...DESKTOP_PRO_CONTEXT, fakeAvatarPickerFile: ANIMATED_AVATAR });
    // An assertion, not a readiness wait: going non-Pro here would mean the rotation behaved like a refund.
    await alice.waitForProActive();

    // Bob has to poll to learn of the rotation, and the relaunch is what forces it.
    await restartApp(bob, DESKTOP_PRO_CONTEXT);
    await bob.verifyConversationHeaderAvatarNotAnimated(alice.userName);

    // A proof travels with a message rather than arriving on its own, so this send is how Bob comes to
    // hold the new generation — which is the question the spec exists to answer. If the picture does not
    // come back here, the recipient never picks the replacement up and no amount of waiting fixes it.
    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_ON_NEW_PROOF);
    await bob.waitForMessage(SENT_ON_NEW_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);
    await bob.assertConversationHeaderAvatarAnimated(alice.userName);
  },
  { ...DESKTOP_PRO_CONTEXT, fakeAvatarPickerFile: ANIMATED_AVATAR }
);
