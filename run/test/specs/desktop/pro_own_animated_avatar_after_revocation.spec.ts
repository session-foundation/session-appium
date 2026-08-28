import { resolve } from 'path';

import { animatedProfilePicture, mediaFolder } from '../../../constants/testfiles';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { revokeAccountPro } from '../../../shared/pro_grant';
import { DESKTOP_PRO_CONTEXT } from '../../../shared/pro_revocation';

const ANIMATED_AVATAR = resolve(mediaFolder, animatedProfilePicture);

/**
 * The desktop half of "an animated display picture freezes once Pro is revoked", seen by its owner.
 *
 * `pro_rotation_animated_avatar` already revokes and re-checks an avatar here, but it is the opposite
 * case on both axes: a **rotation** (`revokePayments: false`, the plan survives) asserted on a
 * **recipient's** copy, which then recovers on the sender's next message. This is a full revocation
 * asserted on the **owner's own** picture, which never recovers because there is no Pro to come back.
 *
 * That distinction is worth more on Desktop than on mobile. Desktop keeps **two** variants of a display
 * picture — a static fallback and the animated original — and chooses between them at display time
 * rather than freezing frames as it renders. So the owner's own view exercises that choice, not the same
 * code from another angle: a client that picked correctly for peers and wrongly for itself would satisfy
 * every other avatar spec here.
 *
 * The picture being **kept** is the other half. A client that deleted it on losing Pro would also stop it
 * animating, and would be destroying the user's data to do so — `verifyOwnAvatarNotAnimated`'s
 * placeholder check is what separates the two.
 */
test_Alice_1W(
  'An animated display picture freezes once Pro is revoked',
  async ({ alice }) => {
    await alice.subscribeToPro();
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    // The control, load-bearing in both directions: without it a still frame later proves nothing, since
    // a fixture that never animated and an upload that never landed both read as a correct freeze.
    await alice.assertSettingsAvatarAnimated();

    // `revokePayments: true` strips the entitlement as well as rotating the generation, so the client is
    // left holding a proof that is both revoked and unrenewable.
    await revokeAccountPro({ user: alice.getUser(), revokePayments: true });
    // A revocation is only real to a client that has fetched since it happened, and the backend serves the
    // production `retry_in`, so `DESKTOP_PRO_CONTEXT` forces the poll on the way back up. The picker file
    // is carried through because the relaunch re-reads it from the environment.
    await restartApp(alice, { ...DESKTOP_PRO_CONTEXT, fakeAvatarPickerFile: ANIMATED_AVATAR });

    await alice.assertSettingsAvatarNotAnimated();
  },
  { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR }
);
