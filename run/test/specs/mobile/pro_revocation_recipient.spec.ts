import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge, expectProBadgeFromSender } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

const SENT_WHILE_VALID = 'Sent while my proof was still good';

bothPlatformsIt({
  title: 'A recipient stops honouring a sender whose proof has been revoked',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRevocationRecipient,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A revoked proof stops being honoured by the party that verifies it: the recipient renders the ' +
    "sender's Pro badge while the proof is live and drops it once the revocation list reaches them.",
});

/**
 * The only spec in which a SECOND party decides whether a Pro credential is good.
 *
 * Everything else about Pro can be satisfied by a client believing its own claim about itself. Here Bob
 * verifies Alice's proof, and the revocation list is the one input that can make a cryptographically
 * valid, unexpired proof worthless. That makes it the sharpest test of the credential being real: a
 * display-level mock produces nothing for Bob to reject, and a client that ignores the list renders a
 * badge for a sender the backend has disavowed.
 *
 * The order is load-bearing. Alice sends while her proof is live and Bob is asserted to honour it FIRST,
 * because the interesting assertion is an absence and an absence proves nothing on its own — a badge that
 * was never there satisfies the second half perfectly. The pair is what distinguishes "stopped honouring"
 * from "never honoured".
 *
 * Revoked as a ROTATION rather than a refund: Alice keeps her entitlement and rolls onto a fresh
 * generation, so the only thing that changed is that the proof already in Bob's hands is dead. A refund
 * would also strip Alice's Pro, and then a missing badge would be explained by her no longer being a
 * subscriber at all — true, and not what this asserts.
 *
 * Alice is deliberately NOT restarted after the revocation. Every client drops a revoked proof within one
 * poll of noticing, so restarting her would re-arm her on the new generation and there would be no dead
 * credential left for Bob to reject.
 */
async function proRevocationRecipient(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Two devices and a seeded contact, because the claim has a receiving half: only a second party
  // verifies the credential, and that is what a mocked proof could never satisfy.
  //
  // `forceProRevocationRefresh` is a precondition, not a convenience. The backend serves the production
  // cadence — `retry_in: 86400`, inside libSession's [60s, 48h] clamp, so nothing shortens it — which puts
  // a client's second poll a day after its first. Without it Bob never learns of the revocation inside the
  // run, and the final assertion would pass on a client that had simply not looked.
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
    iOSContext: { ...IOS_PRO_CONTEXT, forceProRevocationRefresh: true },
  });
  const { alice1, bob1 } = devices;

  await test.step('Grant Pro and let the client observe it', async () => {
    // A full-length plan, unlike `pro_overhang`'s seconds-long one: nothing here turns on the expiry, and
    // a short grant would arm the expiring-soon CTA over the conversation list for no reason.
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
  });

  // Being Pro is not the same as advertising it: badge visibility is a separate per-user setting, off by
  // default, and a grant does not touch it. Without this the badge never renders for Bob and the
  // revocation assertion below would pass against a client that had nothing to withdraw.
  await enableProBadge(alice1, platform);

  await test.step('Send a message while the proof is live', async () => {
    // `enableProBadge` closes settings back to the home screen, so the conversation has to be reopened.
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_WHILE_VALID);
  });

  // The control half, and the half a mock cannot reach: Bob has verified a real signature against the
  // backend's key. With a display-level fixture on Alice, no badge appears here at all. The message is
  // waited on first because the badge follows the sender's PROFILE, which rides along with it.
  await expectProBadgeFromSender(bob1, prebuilt.alice.userName, SENT_WHILE_VALID);

  await test.step("Revoke Alice's current generation", async () => {
    await revokeAccountPro({
      user: prebuilt.alice,
      revokePayments: false,
      effectiveInSeconds: 0,
    });
  });

  await test.step('Bob polls, and stops honouring it', async () => {
    // Bob has to POLL to learn of it — the revocation is not pushed to him. The relaunch is what forces
    // that poll, and on iOS it also forces the view rebuild the badge needs: an already-effective
    // revocation can be fetched, cached and honoured while the badge stays drawn.
    await forceStopAndRestart(bob1);
    await bob1.assertNoSenderProBadge(prebuilt.alice.userName);
  });

  await closeApp(alice1, bob1);
}
