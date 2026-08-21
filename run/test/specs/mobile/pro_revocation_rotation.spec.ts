import { test, type TestInfo } from '@playwright/test';

import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { ConversationHeaderProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge, expectProBadgeFromSender } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

const SENT_ON_OLD_PROOF = 'Sent on the proof that was rotated away';
const SENT_ON_NEW_PROOF = 'Sent on the replacement proof';

bothPlatformsIt({
  title: 'A rotation keeps the subscription and swaps which proof is honoured',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRevocationRotation,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'Revoking only the generation leaves the account Pro, kills the proof already in a peer’s hands, ' +
    'and is superseded by the replacement once the sender re-arms and sends again.',
});

/**
 * Rotation end to end, and the counterpart to the refund spec.
 *
 * Both revoke the proof the sender is holding; only the refund takes the entitlement with it. A client
 * that cannot separate them fails one way or the other — strip Pro from a paying subscriber, or leave a
 * refunded account Pro — so the two specs are a pair and neither means much alone.
 *
 * It is one spec rather than a sender-side and a recipient-side half because **nothing the sender can show
 * distinguishes a live proof from a dead one**. Every sender-side surface reads the entitlement: the
 * composer's limit comes from `getSelf().isPro` on Android and the equivalent elsewhere, and never
 * consults the proof — measured on all three clients, and the reason a status-Active client with no proof
 * composes past the standard limit and has every recipient silently truncate it. So the sender can only
 * establish that the subscription survived; whether the credential was actually replaced is a question
 * only a peer can answer.
 *
 * The three claims are therefore checked where each is observable:
 *   - the plan is still active after the rotation      — sender, and the guard against rotation-as-refund
 *   - the proof already delivered stops being honoured — recipient
 *   - the replacement is honoured in its place         — recipient
 *
 * Ordering is load-bearing. The rejection has to be asserted BEFORE the sender's next message: a message
 * carries its proof, so the moment one arrives on the new generation the recipient's record is updated and
 * the absence being asserted is gone. Sequential rather than side-by-side for the same reason iOS forces
 * elsewhere — it derives the badge from the sender's profile, so two messages from one sender cannot
 * disagree and a simultaneous old-vs-new comparison would assert nothing there.
 */
async function proRevocationRotation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    // Every badge assertion starts from the conversation list.
    focusFriendsConvo: false,
    testInfo,
    testContext: {
      ...IOS_PRO_CONTEXT,
      // The rotation reaches Bob only through the revocation list, and the backend's own cadence puts
      // his second poll a day out.
      forceProRevocationRefresh: true,
    },
  });
  const { alice1, bob1 } = devices;

  await test.step('Grant Pro and let the client observe it', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
  });

  // Badge visibility is a separate per-user setting, off by default, and a grant does not touch it.
  await enableProBadge(alice1, platform);

  await test.step('Send on the proof that is about to be rotated', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_ON_OLD_PROOF);
  });

  // The control: an absence later means nothing unless the badge was there first.
  await expectProBadgeFromSender(bob1, prebuilt.alice.userName, SENT_ON_OLD_PROOF);

  await test.step('Rotate the generation, and the subscription survives it', async () => {
    // `revokePayments: false` is the whole difference from the refund spec. The helper refuses to
    // continue if the backend allocated no replacement, so a rotation that quietly behaved like a refund
    // fails here rather than misleading everything downstream.
    await revokeAccountPro({ user: prebuilt.alice, revokePayments: false, effectiveInSeconds: 0 });
    // Asserts the plan is still active AND re-arms Alice on the replacement, which are the same route:
    // the stats header renders only for an active plan, and nothing but this visit asks for a proof the
    // client does not yet know it needs.
    await observeProGrant(alice1);
  });

  await test.step('The proof already in the recipient’s hands stops being honoured', async () => {
    // Bob has to poll to learn of the rotation; the relaunch is what forces it, and on iOS it also
    // rebuilds the view the badge is drawn from.
    await forceStopAndRestart(bob1);
    await bob1.assertNoSenderProBadge(prebuilt.alice.userName, SENT_ON_OLD_PROOF);
  });

  await test.step('The replacement proof is honoured in its place', async () => {
    // Alice re-armed above, so this message carries the new generation's proof — which is also how Bob
    // comes to hold it, since a proof travels with the message rather than arriving on its own.
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_ON_NEW_PROOF);

    // Asserted without `expectProBadgeFromSender` for its delivery wait: this is a SECOND message,
    // arriving after both ends have relaunched, and the generic element default of 30s cut it off at
    // 30.1s on iOS three runs running. The suite's own delivery budget is 45s, and the badge cannot be
    // judged before the message it hangs off has landed.
    await bob1.openConversationWith(prebuilt.alice.userName);
    await bob1.waitForTextElementToBePresent({
      ...new MessageBody(bob1, SENT_ON_NEW_PROOF).build(),
      maxWait: MESSAGE_DELIVERY_TIMEOUT_MS,
    });
    await bob1.waitForTextElementToBePresent(new ConversationHeaderProBadge(bob1));
  });

  await closeApp(alice1, bob1);
}
