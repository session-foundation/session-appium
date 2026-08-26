import { test, type TestInfo } from '@playwright/test';

import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../../../shared/constants';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { SENT_ON_NEW_PROOF, SENT_ON_OLD_PROOF } from '../../../shared/pro_revocation';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CloseSettings } from '../../locators';
import { ConversationSettings, MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { UserAvatar } from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

bothPlatformsIt({
  title: 'An animated display picture survives a proof rotation',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRotationAnimatedAvatar,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A rotation kills the proof a recipient is holding, so an animated display picture freezes until ' +
    'the sender’s next message carries the replacement — and then animates again.',
});

/**
 * The animated-display-picture counterpart to the badge rotation spec, and the case a manual pass
 * recorded as a deviation on Desktop: "a standard user should see another Pro user's animated profile
 * picture — **(not after renewal)**".
 *
 * "Animated" is not a property of the picture on the wire. Each client recomputes it from the sender's
 * Pro proof and freezes the frame when the proof does not satisfy the gate, so a display picture is only
 * as animated as the recipient's copy of the sender's credential is live. That makes it the one Pro
 * surface where a stale credential is **silent**: a frozen animation is a perfectly ordinary still
 * picture, and nobody reports one.
 *
 * A rotation is used to make the credential stale rather than a renewal, because it is what the harness
 * can drive deterministically — `revokePayments: false` kills the generation and leaves the plan intact,
 * which is precisely the state a renewal leaves a recipient in: an entitlement that is still valid and a
 * proof in someone else's hands that no longer is.
 *
 * The three assertions are what separate the two explanations for that manual note:
 *
 *   1. it animates before the rotation        — without this the freeze below proves nothing
 *   2. it freezes once the proof is rotated   — the recipient acts on the revocation
 *   3. it animates again on the next message  — the replacement proof reaches the recipient
 *
 * If 3 holds, the manual observation is the *window* between a rotation and the sender's next message,
 * which is inherent to proofs travelling with messages rather than arriving on their own. If 3 fails,
 * the recipient never picks the replacement up and the picture stays frozen for good — a real defect,
 * and one no amount of waiting fixes.
 */
async function proRotationAnimatedAvatar(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false,
    testInfo,
    testContext: {
      ...PRO_BACKEND_CONTEXT,
      // The rotation reaches Bob only through the revocation list, and the backend serves the production
      // cadence, which would put his second poll a day out.
      forceProRevocationRefresh: true,
    },
  });
  const { alice1, bob1 } = devices;

  await test.step('Give the sender real Pro and an animated picture', async () => {
    // A real grant, not a mock: the picture is written to libSession config and the display mocks write
    // no config, so a mocked subscriber uploads a picture that never animates for anyone.
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
    await alice1.uploadProfilePicture(true);
    // Sender-side control: the fixture really does animate, so a still frame later is a decision rather
    // than a picture that never moved.
    await alice1.verifyElementIsAnimated(new UserAvatar(alice1));
    await alice1.clickOnElementAll(new CloseSettings(alice1));
  });

  await test.step('The recipient animates it while the proof is live', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_ON_OLD_PROOF);

    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    await bob1.waitForTextElementToBePresent({
      ...new MessageBody(bob1, SENT_ON_OLD_PROOF).build(),
      maxWait: MESSAGE_DELIVERY_TIMEOUT_MS,
    });
    await bob1.verifyElementIsAnimated(new ConversationSettings(bob1));
  });

  await test.step('Rotate the generation, and the subscription survives it', async () => {
    // The helper refuses to continue if the backend allocated no replacement, so a rotation that quietly
    // behaved like a refund fails here rather than misleading everything below.
    await revokeAccountPro({ user: prebuilt.alice, revokePayments: false, effectiveInSeconds: 0 });
    // An assertion as much as a step: going non-Pro here would mean the rotation behaved like a refund.
    // Alice drops the revoked proof and asks for its replacement on this visit.
    await observeProGrant(alice1);
  });

  await test.step('The picture freezes while the recipient holds only the dead proof', async () => {
    // Bob has to poll to learn of the rotation, and the relaunch is what forces it.
    await forceStopAndRestart(bob1);
    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    await bob1.verifyElementIsNotAnimated(new ConversationSettings(bob1));
  });

  await test.step('The next message carries the replacement, and it animates again', async () => {
    // A proof travels with a message rather than arriving on its own, so this send is how Bob comes to
    // hold the new generation at all — which is the whole question this spec exists to answer.
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_ON_NEW_PROOF);

    await bob1.waitForTextElementToBePresent({
      ...new MessageBody(bob1, SENT_ON_NEW_PROOF).build(),
      maxWait: MESSAGE_DELIVERY_TIMEOUT_MS,
    });
    await bob1.verifyElementIsAnimated(new ConversationSettings(bob1));
  });

  await closeApp(alice1, bob1);
}
