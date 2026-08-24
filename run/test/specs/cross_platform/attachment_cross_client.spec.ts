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

type Pairing = {
  sender: 'android' | 'desktop' | 'ios';
  recipient: 'android' | 'desktop' | 'ios';
};

/**
 * One test per DIRECTION, not per pairing: the two halves exercise different implementations — one
 * writes and one reads — so a pairing that works one way tells you nothing about the other.
 */
function attachmentPairing({ sender, recipient }: Pairing) {
  crossPlatformTest({
    title: `Attachment renders across clients (${sender} sends, ${recipient} receives)`,
    risk: 'high',
    setup: friends({
      alice: { [sender]: 1 },
      bob: { [recipient]: 1 },
    }),
    testCb: async ({ accounts: { alice, bob } }) => {
      const from = alice[sender][0];
      const to = bob[recipient][0];

      await from.openConversationWith(bob.account.userName);
      await sendPhoto(from, CAPTION);

      await to.openConversationWith(alice.account.userName);
      await verifyPhotoRendered(to, CAPTION, alice.account.userName);
    },
  });
}

attachmentPairing({ sender: 'android', recipient: 'desktop' });
attachmentPairing({ sender: 'desktop', recipient: 'android' });
attachmentPairing({ sender: 'ios', recipient: 'desktop' });
attachmentPairing({ sender: 'desktop', recipient: 'ios' });
attachmentPairing({ sender: 'ios', recipient: 'android' });
attachmentPairing({ sender: 'android', recipient: 'ios' });
