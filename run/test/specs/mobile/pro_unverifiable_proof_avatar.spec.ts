import { test, type TestInfo } from '@playwright/test';

import { MESSAGE_DELIVERY_TIMEOUT_MS, UNTRUSTED_PRO_BACKEND_KEY } from '../../../shared/constants';
import { makeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CloseSettings } from '../../locators';
import { ConversationSettings, MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { UserAvatar } from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';

const SENT_WITH_FAKE_PROOF = 'Sent with a fake proof';

// Verified as a matched pair: with this left undefined — recipient on the real key — the avatar DOES
// animate for the recipient (Android 41s), so a still frame here is the client refusing a feature whose
// proof it cannot verify, not a fixture that never produced an animation.
const RECIPIENT_BACKEND_KEY: string | undefined = UNTRUSTED_PRO_BACKEND_KEY;

bothPlatformsIt({
  title: 'A recipient does not animate a display picture it cannot verify',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proUnverifiableProofAvatar,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'An animated display picture whose proof the recipient cannot verify against its configured ' +
    'backend key renders as a still frame, while the sender — holding the same real proof — animates it.',
});

/**
 * The animated-display-picture half of "a recipient does not honour a proof it cannot verify".
 *
 * The badge spec covers the same refusal for `proBadge`; this covers the animated avatar. Separate per
 * feature so a client that wrongly honours one and correctly refuses the other is identifiable from the
 * results rather than masked by the other.
 *
 * A real grant, not a mock: the animated picture is written to libSession config and the display mocks
 * write no config, so a mocked subscriber uploads a picture that never renders as animated for anyone.
 *
 * `proBackendPubkey` is a per-device override of the key the client verifies proofs against, so only the
 * recipient's trust changes — the proof itself is genuinely minted and signed.
 *
 * 🔴 The freeze is not instantaneous. Observed on Android: the picture animates for a frame or two and
 * then stops, which is consistent with the image rendering as an animated GIF on first paint and the
 * entitlement check landing on a later pass (`freezeFrameForUser`). So the settle before sampling guards
 * BOTH directions — shortening it would catch those opening frames and fail a client that is refusing
 * correctly. Worth a look on its own terms: a briefly-animating picture is a small leak of a feature the
 * recipient has decided not to honour.
 */
async function proUnverifiableProofAvatar(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false,
    testInfo,
    testContext: [
      IOS_PRO_CONTEXT,
      RECIPIENT_BACKEND_KEY
        ? { ...IOS_PRO_CONTEXT, proBackendPubkey: RECIPIENT_BACKEND_KEY }
        : IOS_PRO_CONTEXT,
    ],
  });
  const { alice1, bob1 } = devices;

  await test.step('Give the sender real Pro and an animated picture', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform });
    await observeProGrant(alice1);
    await alice1.uploadProfilePicture(true);
    // Sender-side control: the picture really animates here, so a still one at the recipient is the
    // recipient's decision rather than a fixture that never produced an animation.
    await alice1.verifyElementIsAnimated(new UserAvatar(alice1));
    await alice1.clickOnElementAll(new CloseSettings(alice1));
  });

  await test.step('Send, so the profile rides along with the message', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    await alice1.sendMessage(SENT_WITH_FAKE_PROOF);
  });

  await test.step('The recipient renders it as a still frame', async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, prebuilt.alice.userName));
    await bob1.waitForTextElementToBePresent({
      ...new MessageBody(bob1, SENT_WITH_FAKE_PROOF).build(),
      maxWait: MESSAGE_DELIVERY_TIMEOUT_MS,
    });
    await bob1.verifyElementIsNotAnimated(new ConversationSettings(bob1));
  });

  await closeApp(alice1, bob1);
}
