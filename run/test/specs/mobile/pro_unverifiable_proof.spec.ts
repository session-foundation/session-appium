import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { iosIt } from '../../../types/sessionIt';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { MessageInfoMenuItem, ProBadge } from '../../locators/pro';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';

const SENT_WITH_REAL_PROOF = 'Sent with a genuine proof';

/**
 * A well-formed Ed25519 key the Pro backend never signed with.
 *
 * Used to make the RECIPIENT unable to verify a proof that is genuinely valid, which is the only way to
 * exercise the verification path without a client that can forge one: the proof is real, the signature is
 * real, and the recipient simply does not trust the signer.
 */
const UNTRUSTED_BACKEND_KEY = '0'.repeat(64);

// The recipient trusts a key the backend never signed with. Verified as a matched pair: with this left
// undefined — both devices on the real key — the badge assertion below PASSES (39s), so its absence here
// is the recipient refusing a signature it cannot verify, not a claim that was never made.
const RECIPIENT_BACKEND_KEY: string | undefined = UNTRUSTED_BACKEND_KEY;

iosIt({
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
 * iOS only for now: the harness wires a per-device Pro backend override on iOS
 * (`iosProBackendUrl`/`iosProBackendPubkey`), while Android takes its backend from the AQA build variant.
 * The app side supports it on both (`QaLaunchConfig`'s `EXTRA_PRO_BACKEND_PUBKEY`), so this is a harness
 * gap rather than a platform deviation.
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
        ? { ...IOS_PRO_CONTEXT, iosProBackendPubkey: RECIPIENT_BACKEND_KEY }
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
    await alice1.sendMessage(SENT_WITH_REAL_PROOF);
  });

  await test.step('The sender records Pro on its own copy of the message', async () => {
    // Half the control: the message went out WITH a genuine proof. Read from the message's own info
    // screen, NOT the conversation header — the header badge shows the OTHER party's Pro status, so on
    // the sender's device it asserts the recipient's, which is not what this needs.
    await alice1.longPressMessage(new MessageBody(alice1, SENT_WITH_REAL_PROOF));
    await alice1.clickOnElementAll(new MessageInfoMenuItem(alice1));
    await alice1.waitForTextElementToBePresent(new ProBadge(alice1));
    await alice1.navigateBack();
  });

  await test.step('The recipient does not honour a proof it cannot verify', async () => {
    // The claim. The message itself must arrive first — `assertNoSenderProBadge` anchors on it, so a
    // badge-less screen cannot be satisfied by a message that never landed.
    await bob1.assertNoSenderProBadge(prebuilt.alice.userName, SENT_WITH_REAL_PROOF);
  });

  await closeApp(alice1, bob1);
}
