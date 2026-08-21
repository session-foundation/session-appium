import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { sleepFor } from '../../utils';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge, expectProBadgeFromSender } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

const SENT_WHILE_VALID = 'Sent before the revocation was issued';

/**
 * How far ahead the revocation is dated. Has to outlast Bob's relaunch, poll settle and badge assertion,
 * which measured ~10s across the three clients; the rest is headroom for a loaded host. Undershooting is
 * caught by the guard below rather than silently weakening the claim.
 */
const EFFECTIVE_IN_SECONDS = 20;

/**
 * Time allowed for the forced revocation poll to land after Bob's relaunch.
 *
 * A bounded wait rather than an observed event, because nothing in the UI reveals that the list arrived.
 * It is what makes the first half mean anything: without it "still honoured" is equally satisfied by a
 * client that has not yet looked, which is the one reading that would make this spec vacuous.
 */
const REVOCATION_POLL_SETTLE_MS = 5000;

bothPlatformsIt({
  title: 'A revocation is not honoured before it takes effect',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proRevocationNotYetEffective,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A recipient that has already fetched a revocation keeps honouring the proof until the revocation ' +
    'becomes effective, and stops once it does.',
});

/**
 * The delay in a revocation is a guarantee, not slack, and this is the spec that holds it.
 *
 * A served revocation carries its own `effective_ts`, and the backend dates it ahead of the moment it was
 * recorded on purpose: `revoked_at + REVOCATION_EFFECTIVE_DELAY`, so that a revoked sender is certain to
 * have polled and learnt of its own tag before any peer starts rejecting it. A client that enforced on
 * receipt instead of on the effective instant would reject a sender that has had no opportunity to know.
 *
 * The list is served unfiltered — every entry inside the retention window is sent, whether effective or
 * not — so the decision is entirely the client's, which is what makes it worth asserting.
 *
 * 🔴 Both halves are required, and the second is the control for the first. "The badge is still there"
 * is satisfied perfectly by a client that never fetched the revocation at all, so on its own it proves
 * nothing. Asserting that the SAME client drops the badge once the instant passes is what establishes the
 * entry was in its list the whole time and that the honouring was a decision rather than ignorance.
 *
 * Revoked as a ROTATION, not a refund: Alice keeps her entitlement and rolls onto a fresh generation, so
 * the only thing that changes is the status of the proof Bob is already holding. A refund would also end
 * her subscription, and a missing badge would then have an innocent explanation.
 *
 * Alice is never restarted. She would re-arm on the new generation and send from a live proof, leaving
 * nothing pending for Bob to weigh.
 */
async function proRevocationNotYetEffective(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    // Every badge assertion starts from the conversation LIST; a focused fixture leaves the device inside
    // the conversation with no list item to click.
    focusFriendsConvo: false,
    testInfo,
    testContext: { ...IOS_PRO_CONTEXT, forceProRevocationRefresh: true },
  });
  const { alice1, bob1 } = devices;

  await test.step('Grant Pro and let the client observe it', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
  });

  // Badge visibility is a separate per-user setting, off by default, and a grant does not touch it.
  // Without this no badge renders for Bob and both halves below assert nothing.
  await enableProBadge(alice1, platform);

  await test.step('Send a message while the proof is live', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_WHILE_VALID);
  });

  await expectProBadgeFromSender(bob1, prebuilt.alice.userName, SENT_WHILE_VALID);

  const effectiveAtMs = await test.step('Issue a revocation dated in the future', async () => {
    const result = await revokeAccountPro({
      user: prebuilt.alice,
      revokePayments: false,
      effectiveInSeconds: EFFECTIVE_IN_SECONDS,
    });
    return result.effective_ts * 1000;
  });

  await test.step('Bob has the revocation and still honours the proof', async () => {
    // The relaunch is what makes Bob poll, so after it he holds the entry — with an effective instant
    // still ahead of him.
    await forceStopAndRestart(bob1);
    await sleepFor(REVOCATION_POLL_SETTLE_MS);
    await expectProBadgeFromSender(bob1, prebuilt.alice.userName, SENT_WHILE_VALID);

    // Fails loudly as a timing shortfall rather than silently weakening the claim: if the instant has
    // already passed, the assertion above proved nothing about honouring a PENDING revocation.
    if (Date.now() >= effectiveAtMs) {
      throw new Error(
        `The revocation became effective before the badge could be asserted, so nothing was verified ` +
          `about a pending revocation. Raise EFFECTIVE_IN_SECONDS above ${EFFECTIVE_IN_SECONDS}s for ` +
          `this host.`
      );
    }
  });

  await test.step('Once it takes effect, the same client stops honouring it', async () => {
    // To a DEADLINE from the revocation rather than a fresh countdown: the time already spent proving the
    // first half is time the delay was already burning.
    await sleepFor(Math.max(0, effectiveAtMs - Date.now()));
    // Restarted for the same reason as in the recipient spec: on iOS the badge needs the view rebuilt,
    // and a cached entry becoming effective does not on its own redraw what is already on screen.
    await forceStopAndRestart(bob1);
    await bob1.assertNoSenderProBadge(prebuilt.alice.userName, SENT_WHILE_VALID);
  });

  await closeApp(alice1, bob1);
}
