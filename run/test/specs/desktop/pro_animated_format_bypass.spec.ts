import { resolve } from 'path';

import { animatedProfilePictureAsPng, mediaFolder } from '../../../constants/testfiles';
import { CTA } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W, test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { MESSAGE_DELIVERY_TIMEOUT_MS, UNTRUSTED_PRO_BACKEND_KEY } from '../../../shared/constants';
import { SENT_WITH_FAKE_PROOF } from '../../../shared/pro_revocation';

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

/**
 * The receiving side of the same fixture, and the case only Desktop can fail.
 *
 * Desktop does not decide "animate or not" at render. `processAvatarData` extracts a **static first
 * frame** at processing time and stores it alongside the animated one, and
 * `Conversation.getProOrNotAvatarPath()` then hands out whichever the peer is entitled to — the
 * animated path when `hasValidCurrentProProof()`, the fallback otherwise.
 *
 * That makes the fallback a piece of derived data whose correctness depends on the extractor knowing
 * the file is animated. Hand it a file whose extension says otherwise and there is a path where the
 * "static" fallback is the whole animation — and then every peer that is supposed to see a still
 * frame animates instead. That is the leak the sender-side cases above cannot reach: they only prove
 * a standard user is stopped from uploading, not what happens to a file that did get uploaded.
 *
 * Alice holds a real grant, so the upload is legitimate and the file reaches the network exactly as it
 * would in production. Only Bob's trust is changed: `proBackendPubkey` points him at a key the proof
 * was not signed with, so he cannot verify it and must fall back — which is the whole point, because
 * the fallback is the artefact under test.
 *
 * The sender-side control is not optional here. Without Alice's own avatar animating, a still frame at
 * Bob is equally satisfied by a file that never animated for anybody.
 */
test_Alice_1W_Bob_1W_friends(
  'A recipient who cannot verify the proof gets a still frame from a renamed animated file',
  async ({ alice, bob }) => {
    await alice.subscribeToPro();
    await restartApp(alice, { pro: {}, fakeAvatarPickerFile: MASQUERADING_AVATAR });
    await alice.waitForProActive();

    await alice.uploadProfilePicture();
    // Sender-side control: the bytes really do animate for someone entitled to them.
    await alice.verifyOwnAvatarAnimated();

    // Only the recipient's trust changes, and before the message: verification happens at receipt.
    await restartApp(bob, { pro: { proBackendPubkey: UNTRUSTED_PRO_BACKEND_KEY } });

    // The avatar rides along with a message rather than arriving on its own.
    await alice.openConversationWith(bob.userName);
    await alice.sendMessage(SENT_WITH_FAKE_PROOF);
    await bob.openConversationWith(alice.userName);
    await bob.waitForMessage(SENT_WITH_FAKE_PROOF, MESSAGE_DELIVERY_TIMEOUT_MS);

    // If this animates, the "static" fallback Desktop derived from a `.png`-named GIF is not static,
    // and a peer with no valid proof is seeing a Pro feature.
    await bob.verifyConversationHeaderAvatarNotAnimated(alice.userName);
  },
  { pro: {}, fakeAvatarPickerFile: MASQUERADING_AVATAR }
);
