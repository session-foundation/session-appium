import { resolve } from 'path';

import { animatedProfilePictureAsPng, mediaFolder } from '../../../constants/testfiles';
import { CTA } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W } from '../../../desktop/sessionTest';

/**
 * Whether the animated-display-picture gate reads the file's contents or its name.
 *
 * The fixture is [animatedProfilePictureAsPng]: the same animated GIF the other Pro avatar specs use,
 * byte for byte, renamed to `.png`. A client that decides "is this animated?" from the extension sees a
 * still image and lets a standard user upload it — and the picture then animates for everyone, because
 * what recipients render is the file, not the sender's claim about it.
 *
 * That makes this the enforcement half of the animated-avatar coverage. The existing specs prove the
 * gate refuses an honestly-named GIF; only this one can fail when the gate is looking at the wrong
 * thing.
 *
 * The two cases are a matched pair and neither means much alone:
 *
 *   - **standard user** — the CTA appearing is the client recognising an animation despite the name.
 *     No CTA is not a passing case, it is the bypass.
 *   - **Pro user** — the same file uploads and animates, which is what proves the fixture really is
 *     animated. Without it, "the CTA appeared" could be a client refusing every `.png` it is handed.
 */
const MASQUERADING_AVATAR = resolve(mediaFolder, animatedProfilePictureAsPng);

test_Alice_1W(
  'Animated file renamed to dodge the format gate (non Pro)',
  async ({ alice }) => {
    await alice.uploadProfilePicture();
    // Reached only if the client inspected the bytes. If it trusted `.png` there is no CTA, the upload
    // succeeds, and a standard user is wearing an animated display picture.
    await alice.checkCTA('animatedProfilePicture');
    await alice.clickOn(CTA.cancelButton);
  },
  { pro: { proBackendStatus: 'never' }, fakeAvatarPickerFile: MASQUERADING_AVATAR }
);

test_Alice_1W(
  'Animated file renamed to dodge the format gate (Pro)',
  async ({ alice }) => {
    await alice.subscribeToPro();
    // Desktop asks the backend for status only at startup, so the grant is invisible until restart.
    await restartApp(alice, { pro: {}, fakeAvatarPickerFile: MASQUERADING_AVATAR });
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);
    // The control for the case above: the bytes really do animate, so a standard user being stopped is
    // the gate working rather than the file being unremarkable.
    await alice.verifyOwnAvatarAnimated();
  },
  { pro: {}, fakeAvatarPickerFile: MASQUERADING_AVATAR }
);
