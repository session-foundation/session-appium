import { test, type TestInfo } from '@playwright/test';

import { OVER_STANDARD_CHARS } from '../../../shared/message';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CloseSettings } from '../../locators';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import { UserAvatar, UserSettings } from '../../locators/settings';
import { open_Alice1_with_contacts } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

bothPlatformsIt({
  title: 'An animated display picture freezes once Pro is revoked',
  risk: 'high',
  countOfDevicesNeeded: 1,
  isPro: true,
  testCb: ownAnimatedAvatarAfterRevocation,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A subscriber sets an animated display picture and then loses Pro. The picture is kept, and stops ' +
    'animating on their own device.',
});

/**
 * A picture the user is no longer entitled to animate, seen by its owner.
 *
 * The neighbouring specs all assert this from the far side: `pro_rotation_animated_avatar` freezes a
 * *recipient's* copy when the sender's proof rotates, and `pro_unverifiable_proof_avatar` freezes it when
 * the recipient cannot verify the proof at all. Neither says anything about the owner's own device,
 * where the picture is a local file rather than something fetched — so a client that gated only the
 * inbound path would satisfy both and still animate for the one person guaranteed to look at it.
 *
 * That is the whole claim here: **the gate is on rendering, not on receiving.** The picture itself is
 * kept, which is the other half — a client that deleted it on losing Pro would also stop it animating,
 * and would be destroying the user's data to do so.
 *
 * **The gate reads ACCESS, not display status.** Access outlives the plan: a lapsed subscriber holding a
 * still-valid proof keeps every Pro feature until that proof dies, which is the overhang `pro_overhang`
 * covers. So the revocation has to reach the proof, and the client has to have polled for it — hence
 * `forceProRevocationRefresh` below, and the access-backed control before the assertion.
 *
 * **This is the revoked case, not the grandfathered one.** A user who never subscribed cannot upload an
 * animated picture in the first place, so the state where one exists without Pro is only reachable by
 * losing Pro after setting it. The truly grandfathered case — a picture carried in from before Pro
 * existed — needs the seeder to write a display picture directly.
 */
async function ownAnimatedAvatarAfterRevocation(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const { device, alice, contactNames } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_with_contacts({
      platform,
      testInfo,
      // A precondition, not a convenience. The backend serves the production cadence — `retry_in: 86400`,
      // inside libSession's [60s, 48h] clamp — so without this the client's next revocation poll is a day
      // away, the proof stays valid for the whole run, and the picture keeps animating correctly.
      testContext: { ...PRO_BACKEND_CONTEXT, forceProRevocationRefresh: true },
    });
  });

  await test.step('Alice becomes a Pro subscriber and sets an animated picture', async () => {
    // A real grant, not a display mock: the picture is written to libSession config, and the display
    // mocks write no config — a mocked subscriber uploads a picture that never animates for anyone.
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(device);
    await device.uploadProfilePicture(true);
  });

  await test.step('Assert it animates while Pro', async () => {
    // The control, and it is load-bearing in both directions. Without it a still frame later proves
    // nothing: the fixture might never have animated, or the upload might never have landed, and either
    // would read as a correct freeze.
    await device.verifyElementIsAnimated(new UserAvatar(device));
    await device.clickOnElementAll(new CloseSettings(device));
  });

  await test.step('Pro is revoked', async () => {
    // `revokePayments: true` strips the entitlement as well as rotating the generation, so the client is
    // left holding a proof that is both revoked and unrenewable.
    await revokeAccountPro({ user: alice, revokePayments: true });
    await forceStopAndRestart(device);
    // Losing Pro raises the expiry CTA off the status just fetched, so whether it is up races the poll
    // and it cannot be asserted; left up it swallows the taps that follow.
    await device.dismissAnyProCTA();
  });

  await test.step('Assert the client has lost Pro ACCESS', async () => {
    // Reads ACCESS because that is what the rendering gate reads. The Pro settings row would only show
    // that the plan had lapsed, which is a different question and is true during the overhang too — when
    // the picture should still be animating.
    //
    // The message limit is the cheapest access-backed observable on both platforms: the countdown appears
    // only once the standard limit applies, which happens when the proof stops being honoured.
    await device.clickOnElementAll(new ConversationItem(device, contactNames[0]));
    await device.inputText('x'.repeat(OVER_STANDARD_CHARS), new MessageInput(device), true);
    await device.waitForTextElementToBePresent(new MessageLengthCountdown(device));
    await device.navigateBack();
  });

  await test.step('Assert the picture is kept, and frozen', async () => {
    // `verifyElementIsNotAnimated` fails on the generated placeholder rather than passing, so "the
    // picture was deleted" cannot be mistaken for "the picture is correctly frozen" — the two are
    // different bugs and only the second is what a refusal looks like.
    await device.clickOnElementAll(new UserSettings(device));
    await device.verifyElementIsNotAnimated(new UserAvatar(device));
    await device.clickOnElementAll(new CloseSettings(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
