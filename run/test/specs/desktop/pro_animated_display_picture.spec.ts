import { resolve } from 'path';

import { animatedProfilePicture, mediaFolder } from '../../../constants/testfiles';
import { CTA } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W, test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';

/**
 * Animated display pictures, either side of the Pro boundary.
 *
 * All of these depend on `fakeAvatarPickerFile`: under `isTestIntegration()` the app's avatar picker
 * never opens a file dialog, and without that flag it returns a generated solid-colour JPEG — so
 * nothing animated could be selected and the Pro gate was unreachable from a test.
 *
 * The Pro cases take a **real grant** rather than a status mock. `setAnimatedAvatar` is written to
 * libSession config, and the display mocks write no config at all, so a mocked subscriber uploads an
 * animated picture that never renders as one.
 */

const ANIMATED_AVATAR = resolve(mediaFolder, animatedProfilePicture);

test_Alice_1W(
  'Upload animated profile picture (non Pro)',
  async ({ alice }) => {
    await alice.uploadProfilePicture();
    await alice.checkCTA('animatedProfilePicture');
    await alice.clickOn(CTA.cancelButton);
  },
  { pro: { proBackendStatus: 'never' }, fakeAvatarPickerFile: ANIMATED_AVATAR }
);

test_Alice_1W(
  'Upload animated profile picture (Pro)',
  async ({ alice }) => {
    await alice.subscribeToPro();
    // Desktop asks the backend for status only at startup, so the grant is invisible until restart.
    await restartApp(alice, { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR });
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);
    await alice.assertOwnAvatarAnimated();
  },
  { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR }
);

test_Alice_1W_Bob_1W(
  'Animated Profile Picture shows',
  async ({ alice, bob }) => {
    await alice.createContactWith(bob);

    await alice.subscribeToPro();
    await restartApp(alice, { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR });
    await alice.waitForProActive();

    // Opened before the upload, not after: setting an avatar re-renders and re-sorts the
    // conversation list for a while, and Playwright will not click a row that is still moving.
    await alice.openConversationWith(bob.userName);
    await alice.uploadProfilePicture();
    await alice.sendMessage('Howdy');

    // Asserted where Bob already is, rather than reopening the conversation by name. His window is
    // in it — that is the only place `waitForMessage` could have found the message — and his row for
    // Alice can still be labelled with her account ID at this point, so opening by name is a step
    // that can only fail.
    await bob.waitForMessage('Howdy');
    await bob.verifyElementIsAnimated('[data-testid="conversation-options-avatar"] img');
  },
  { pro: {}, fakeAvatarPickerFile: ANIMATED_AVATAR }
);
