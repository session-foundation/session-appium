import { crossPlatformTest } from '../../utils/cross_platform';
import { sendPhoto, verifyPhotoRendered } from '../../utils/cross_platform_media';
import { friends } from '../../utils/cross_platform_state_builder';

/**
 * An attachment sent by one client renders on a client of a different platform.
 *
 * WHY THIS EXISTS. All three clients now write attachments with libSession's stream encryption. Byte-level
 * format agreement is already proven against a canonical libSession vector, on all three, so this is NOT
 * a format test — it is the network leg the vectors cannot reach: that a file written by one
 * implementation is fetched, decrypted and drawn by another.
 *
 * WHAT MAKES IT ABLE TO FAIL. It asserts the photo RENDERS, not that a bubble arrived. Two
 * implementations can agree with themselves and disagree with each other, and every symptom of that is
 * invisible to a text assertion: the existing same-platform image specs check the message body only, so
 * they pass against a broken placeholder. See `verifyPhotoRendered`.
 *
 * DELIBERATELY FORMAT-AGNOSTIC. Nothing here names a format or a key length, so it passes on builds that
 * predate stream encryption too. That is the point: it is verified green on current builds first, which
 * is what makes a later failure attributable to the change rather than to the spec being new.
 */

const CAPTION = 'Cross-client attachment';

crossPlatformTest({
  title: 'Attachment renders across clients (Android sends, Desktop receives)',
  risk: 'high',
  setup: friends({
    alice: { android: 1 },
    bob: { desktop: 1 },
  }),
  testCb: async ({ accounts: { alice, bob } }) => {
    const sender = alice.android[0];
    const recipient = bob.desktop[0];

    await sender.openConversationWith(bob.account.userName);
    await sendPhoto(sender, CAPTION);

    await recipient.openConversationWith(alice.account.userName);
    await verifyPhotoRendered(recipient, CAPTION, alice.account.userName);
  },
});
