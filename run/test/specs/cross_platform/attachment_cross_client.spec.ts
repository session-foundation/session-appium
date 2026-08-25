import type { ClientPlatform } from '../../../types/target';

import { crossPlatformTest } from '../../utils/cross_platform';
import { sendPhoto, verifyPhotoRendered } from '../../utils/cross_platform_media';
import { friends } from '../../utils/cross_platform_state_builder';

/**
 * An attachment sent by one client renders on a client of a different platform.
 *
 * Byte-level format agreement between the clients is proven elsewhere against a libSession vector, so
 * this covers the leg those vectors cannot reach: a file written by one implementation, fetched and
 * drawn by another.
 *
 * It asserts the photo RENDERS rather than that a bubble arrived, which is what makes it able to fail —
 * the same-platform image specs assert the message body only, so they pass against a broken placeholder.
 *
 * Nothing here names a format or a key length, so it passes on builds either side of a format change.
 * That is what makes a failure attributable to the change rather than to the spec being new.
 */

const CAPTION = 'Cross-client attachment';

type Pairings = {
  sender: ClientPlatform;
  /** Every platform this sender is checked against; one test is declared per entry. */
  recipients: ClientPlatform[];
};

/**
 * One test per DIRECTION, not per pairing: the two halves exercise different implementations — one
 * writes and one reads — so a pairing that works one way tells you nothing about the other.
 */
function attachmentPairing(sender: ClientPlatform, recipient: ClientPlatform) {
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

/** Declared per sender, because what a sender is checked against is the readable unit. */
function attachmentPairings({ sender, recipients }: Pairings) {
  for (const recipient of recipients) {
    attachmentPairing(sender, recipient);
  }
}

attachmentPairings({ sender: 'android', recipients: ['desktop', 'ios'] });
attachmentPairings({ sender: 'desktop', recipients: ['android', 'ios'] });
attachmentPairings({ sender: 'ios', recipients: ['android', 'desktop'] });
