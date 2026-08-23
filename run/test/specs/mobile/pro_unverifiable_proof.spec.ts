import { test, type TestInfo } from '@playwright/test';

import { MESSAGE_DELIVERY_TIMEOUT_MS, UNTRUSTED_PRO_BACKEND_KEY } from '../../../shared/constants';
import { makeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { ConversationHeaderProBadge, MessageInfoMenuItem, ProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';

const SENT_WITH_FAKE_PROOF = 'Sent with a fake proof';

/**
 * The body text says "fake proof" because that is what it is FROM THE RECIPIENT'S SIDE, which is the side
 * under test: the proof is genuinely minted and genuinely signed, and the recipient simply trusts a
 * different key, so it cannot tell this from a forgery.
 */

/**
 * How long the badge is given to appear before its absence is called a refusal.
 *
 * In the matching-key control the badge renders ~2s after the message, so this is ~7x that. It has to be
 * a settle-then-check rather than a poll-until-absent: the badge should never appear here, and any
 * assertion that returns on first sight of "no badge" passes before it would have rendered.
 */
const BADGE_SETTLE_MS = 15_000;

// The recipient trusts a key the backend never signed with. Verified as a matched pair: with this left
// undefined — both devices on the real key — the badge assertion below PASSES (39s), so its absence here
// is the recipient refusing a signature it cannot verify, not a claim that was never made.
const RECIPIENT_BACKEND_KEY: string | undefined = UNTRUSTED_PRO_BACKEND_KEY;

bothPlatformsIt({
  title: 'A recipient does not honour a proof it cannot verify',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proUnverifiableProof,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A Pro message whose proof the recipient cannot verify against its configured backend key is not ' +
    'honoured, while the sender — holding the same real proof — renders it.',
});

/**
 * The verification path, exercised with a REAL proof and an untrusted signer.
 *
 * Every other Pro spec asserts what a client does with a credential it accepts. This asserts what a
 * recipient does with one it cannot verify — the only side that can refuse, and the half no mock can
 * reach: a display-level mock makes a client *believe* it is Pro but attaches nothing, so the recipient
 * refuses nothing and the assertion passes on a message that never carried a claim.
 *
 * Pointing the recipient at a key the backend never signed with is what makes the proof unverifiable
 * while everything else stays real. `pro_backend.ts` already describes the behaviour this provokes: a
 * device on the wrong key reads a valid proof as invalid, strips the Pro content, and stores the sender
 * as non-Pro.
 *
 * `proBackendPubkey` is a per-device override of the key the client verifies proofs against: iOS reads it
 * as the `customProBackendPubkey` launch variable, Android as the `sessionProBackendPubkey` intent extra,
 * and in both the context wins over the environment so only the recipient's trust changes.
 */
async function proUnverifiableProof(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false,
    testInfo,
    // Per device: the sender keeps the real backend key so its proof is genuine, and only the recipient's
    // trust is changed. One shared context cannot express this.
    testContext: [
      IOS_PRO_CONTEXT,
      RECIPIENT_BACKEND_KEY
        ? { ...IOS_PRO_CONTEXT, proBackendPubkey: RECIPIENT_BACKEND_KEY }
        : IOS_PRO_CONTEXT,
    ],
  });
  const { alice1, bob1 } = devices;

  await test.step('Give the sender real Pro', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
  });

  await enableProBadge(alice1, platform);

  await test.step('Send with the genuine proof attached', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_WITH_FAKE_PROOF);
  });

  await test.step('The sender records Pro on its own copy of the message', async () => {
    // Half the control: the message went out WITH a genuine proof. Read from the message's own info
    // screen, NOT the conversation header — the header badge shows the OTHER party's Pro status, so on
    // the sender's device it asserts the recipient's, which is not what this needs.
    await alice1.longPressMessage(new MessageBody(alice1, SENT_WITH_FAKE_PROOF));
    await alice1.clickOnElementAll(new MessageInfoMenuItem(alice1));
    await alice1.waitForTextElementToBePresent(new ProBadge(alice1));
    await alice1.navigateBack();
  });

  await test.step('The recipient does not honour a proof it cannot verify', async () => {
    // The message must arrive first, or an absent badge says nothing.
    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    await bob1.waitForTextElementToBePresent({
      ...new MessageBody(bob1, SENT_WITH_FAKE_PROOF).build(),
      maxWait: MESSAGE_DELIVERY_TIMEOUT_MS,
    });

    // The claim, asserted as "never appears" rather than "is not there yet".
    //
    // `assertNoSenderProBadge` is deliberately NOT used: it exists for the revocation specs, where the
    // badge starts present and must vanish, so it returns the first moment it sees no badge. Here the
    // badge should never appear at all, and that helper passes simply by looking before it would have —
    // the badge renders about 2s after the message in the matching-key control.
    await bob1.verifyElementNotPresent({
      ...new ConversationHeaderProBadge(bob1).build(),
      maxWait: BADGE_SETTLE_MS,
    });
  });

  await closeApp(alice1, bob1);
}
