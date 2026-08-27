import { test, type TestInfo } from '@playwright/test';

import { STANDARD_PIN_LIMIT } from '../../../shared/constants';
import { OVER_STANDARD_CHARS } from '../../../shared/message';
import { makeAccountPro, revokeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { MessageInput, MessageLengthCountdown } from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { ConversationItem, PlusButton } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

/** One past the standard limit, pinned while Pro — the state this spec is about keeping. */
const PINS_WHILE_PRO = STANDARD_PIN_LIMIT + 2;

bothPlatformsIt({
  title: 'Pins over the standard limit survive Pro being revoked',
  risk: 'high',
  countOfDevicesNeeded: 1,
  isPro: true,
  testCb: pinsOverLimitAfterRevocation,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A subscriber pins more conversations than a standard user may, then loses Pro. The pins are kept ' +
    'and adding another is refused.',
});

/**
 * What happens to pins a user is no longer entitled to.
 *
 * The rule is asymmetric, and only the second half is enforced anywhere: existing pins over the standard
 * limit are **kept**, and adding another is **refused**. A client that quietly unpinned the excess on
 * losing Pro would be destroying user state, and nothing else in the suite would notice — every other pin
 * spec runs at or under the limit, where the two halves are indistinguishable.
 *
 * Both halves are asserted for that reason. The refusal alone would pass against a client that had
 * already dropped the user back to five.
 *
 * **The gate reads ACCESS, not display status**, which is why the setup is shaped as it is.
 * `UIContextualAction+Utilities` and `ThreadSettingsViewModel` both test `!currentUserHasProAccess`, and
 * access outlives the plan: a lapsed subscriber holding a still-valid proof keeps every Pro feature until
 * that proof dies. A spec that only ends the plan is therefore testing the overhang (`pro_overhang`),
 * where a further pin is correctly allowed.
 *
 * **This is the revoked cell, not the grandfathered one.** The clients pick the CTA body from two axes —
 * over the limit, and previously subscribed — so "over the limit" describes two states with different
 * copy. This reaches the one an ordinary subscriber reaches. The other (never subscribed, carrying pins
 * from before Pro existed) is not reachable through the UI at all, because the app enforces the limit it
 * would have to violate; it needs the seeder to write conversation priorities directly.
 */
async function pinsOverLimitAfterRevocation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, alice, contactNames } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_with_contacts({
      platform,
      testInfo,
      // `forceProRevocationRefresh` is a precondition, not a convenience. The backend serves the
      // production cadence — `retry_in: 86400`, inside libSession's [60s, 48h] clamp, so nothing shortens
      // it — which puts the client's second poll a day after its first. Without it the proof stays valid
      // for the whole run, access survives, and the pin below is allowed for a reason that has nothing to
      // do with the limit.
      testContext: { ...PRO_BACKEND_CONTEXT, forceProRevocationRefresh: true },
    });
  });

  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(device);
  });

  // Pinned only after the grant. Doing it earlier would stop at the standard limit, which is the thing
  // being escaped — and would read as this spec passing while testing the ordinary case.
  //
  // Deliberately NOT the first N. `assertPinOrder` expects the pinned names hoisted to the top of the
  // order they already had, so pinning a PREFIX of an already-ordered list expects the list unchanged, and
  // every assertion below then passes whether or not anything was pinned. Skipping the first contact is
  // what gives those assertions something to fail on.
  const pinned = contactNames.slice(1, PINS_WHILE_PRO + 1);
  /** Never pinned, so opening it as a composer does not disturb the order under test. */
  const spare = contactNames[0];
  const overLimit = contactNames[PINS_WHILE_PRO + 1];

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(pinned.length), async () => {
    for (const name of pinned) {
      await device.pinConversation(name);
      await device.waitForTextElementToBePresent(new PlusButton(device));
    }
  });

  await test.step('Assert the over-limit pins took effect while Pro', async () => {
    // The control. Without it, a client that never pinned past five would satisfy every assertion below —
    // the pins would "survive" the revocation because they were never made.
    assertPinOrder(beforeOrder, pinned, await getConversationOrder(device));
  });

  await test.step('Pro is revoked', async () => {
    // `revokePayments: true` strips the entitlement as well as rotating the generation, so the client is
    // left holding a proof that is both unrenewable and revoked.
    await revokeAccountPro({ user: alice, revokePayments: true });
    // Forces the poll. Also rebuilds the composer, which on iOS is what re-reads the limit.
    await forceStopAndRestart(device);
    // Losing Pro raises the expiry CTA off the status just fetched, so whether it is up races the poll
    // and it cannot be asserted. Left up it swallows the next swipe, and it would also satisfy a later
    // check for "a CTA is showing" — so the pin CTA could pass without ever being raised.
    await device.dismissAnyProCTA();
  });

  await test.step('Assert the client has lost Pro ACCESS', async () => {
    // The control that decides what a refusal below means, and it reads ACCESS because that is what the
    // pin gate reads. The Pro settings row would only show that the plan has lapsed, which is a different
    // question and is true during the overhang too.
    //
    // The message limit is the cheapest access-backed observable on both platforms: the countdown appears
    // only once the standard limit applies, which happens when the proof stops being honoured.
    await device.clickOnElementAll(new ConversationItem(device, spare));
    await device.inputText('x'.repeat(OVER_STANDARD_CHARS), new MessageInput(device), true);
    await device.waitForTextElementToBePresent(new MessageLengthCountdown(device));
    await device.navigateBack();
  });

  await test.step('Assert every pin survived the revocation', async () => {
    assertPinOrder(beforeOrder, pinned, await getConversationOrder(device));
  });

  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Pinned Conversations CTA'), async () => {
    await device.pinConversation(overLimit);
    await device.checkCTA('pinnedConversationsRenew');
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  await test.step('Assert the extra conversation was NOT pinned', async () => {
    // The CTA appearing is not the same as the pin being refused: a client that showed the CTA and pinned
    // anyway satisfies a CTA-only assertion.
    assertPinOrder(beforeOrder, pinned, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
