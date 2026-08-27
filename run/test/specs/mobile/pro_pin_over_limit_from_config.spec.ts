import { test, type TestInfo } from '@playwright/test';

import { STANDARD_PIN_LIMIT } from '../../../shared/constants';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CTAButtonNegative } from '../../locators/global';
import { ConversationItem, ConversationPinnedIcon, PlusButton } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';

bothPlatformsIt({
  title: 'Pinned conversations above the limit arriving from config (non Pro)',
  risk: 'high',
  testCb: pinnedAboveLimitFromConfig,
  countOfDevicesNeeded: 1,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'An account that has never been Pro, whose config already holds six pinned conversations — one ' +
    'more than the client itself will ever write — keeps all six, refuses a seventh, and lets one be ' +
    'unpinned.',
});

/** One past the standard limit: the smallest config the client could not have produced itself. */
const SEEDED_PIN_COUNT = STANDARD_PIN_LIMIT + 1;

/**
 * Indices into the state's user list, so `1` is the first contact. Contiguous from the newest
 * conversation down, which keeps the expected list order the plain "pinned block, then the rest".
 */
const SEEDED_PINS = Array.from({ length: SEEDED_PIN_COUNT }, (_, i) => i + 1);

/**
 * More pinned conversations than the client will let anyone pin, on an account that has never been Pro.
 *
 * The state is unreachable through the UI — the clients enforce `STANDARD_PIN_LIMIT` and silently refuse
 * the sixth pin — and reachable in production, because config arrives from a linked device or a restore
 * and the pins may have been made while that account was Pro somewhere else. That gap is the whole
 * reason the seeder writes priorities into config directly: no sequence of taps can set this up, so
 * without a seeded fixture the case is untested.
 *
 * Deliberately NOT "was Pro, pinned six, then lapsed": this account has never held a plan, so nothing
 * the client reads about it can explain the six pins away. What it has to do is honour a config it could
 * not have written.
 *
 * The limit itself, either side of the Pro boundary and driven through the UI, is
 * `user_actions_pin_unpin`; the second call site is `pro_pin_from_conversation_settings`. This spec is
 * only about arriving already over it.
 */
async function pinnedAboveLimitFromConfig(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // No Pro mock and no grant: the account is never Pro because nothing ever makes it Pro. Seeded pins
  // are priorities in the contacts config, not a plan — see the seeder's `applyPins`.
  const { device, contactNames, pinnedNames } = await test.step(
    TestSteps.SETUP.NEW_USER,
    async () => {
      return await open_Alice1_with_contacts({
        platform,
        testInfo,
        testContext: PRO_BACKEND_CONTEXT,
        stateOptions: { pins: SEEDED_PINS },
      });
    }
  );

  await test.step('Wait for every seeded conversation to arrive', async () => {
    // Seeded contacts land in the list as their config merges, not all at once, so reading the order
    // immediately races the arrivals — and only the FIRST seeded test in a process loses that race,
    // because later ones find the swarm warm. A short list here would read as a pin that never took.
    for (const name of contactNames) {
      await device.waitForTextElementToBePresent({
        ...new ConversationItem(device, name).build(),
        maxWait: 60_000,
      });
    }
  });

  // Nothing above dismisses a CTA, on purpose. Whether the client should warn an account that it is
  // holding more pins than it may keep is undecided, so this spec neither asserts a warning nor asserts
  // its absence. If one is added, the step below fails on a modal covering the list — which is the right
  // way to find out, and the point at which the assertion has to be written.
  await test.step('Assert every seeded pin is pinned', async () => {
    // `contactNames` is the order the list takes with nothing pinned, so this says the six floated to
    // the top keeping their relative order and the four unpinned kept theirs.
    assertPinOrder(contactNames, pinnedNames, await getConversationOrder(device));
  });

  await test.step('Assert the pin marker is on all six', async () => {
    // 🔶 This is the assertion that encodes "the client honours the sixth pin rather than clamping the
    // display to five". A client that clamps still sorts all six to the top (the sort reads the same
    // priority) and so satisfies the order assertion above, which is why this is asserted separately.
    // If it fails, the failure IS the product question: does an over-limit config render as it is, or is
    // the surplus hidden? Do not weaken this to the first five without that decision.
    // Android only: iOS has no pin marker in the accessibility tree (`ConversationPinnedIcon` throws
    // for it), so the order assertion above is the iOS half's whole claim.
    for (const name of pinnedNames) {
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, name));
    }
  });

  /**
   * The LAST conversation, not the first unpinned one - and the difference is the whole assertion.
   *
   * The seeded pins are contacts 1..6, so the first unpinned row is already in position 7. Pinning it
   * would move it to the end of the pinned block, which IS position 7: the order comes out identical
   * whether the client honoured the pin or refused it, and `assertPinOrder` cannot tell them apart.
   * The check reads as a guard and is vacuous.
   *
   * Pinning the last row instead moves it from tenth to seventh if it is allowed, so the order says
   * which happened.
   */
  const pinTarget = contactNames[contactNames.length - 1];

  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Pinned Conversations CTA'), async () => {
    await device.pinConversation(pinTarget);

    // FAILS ON iOS TODAY, and the failure is the point. Android refuses the seventh pin and raises this
    // CTA; iOS does neither - it PINS it, leaving a standard account holding seven against a limit of
    // five. Verified: the order assertion below reports Kevin moved from tenth to seventh.
    //
    // Asserted on both platforms deliberately. Gating it to Android would hide a real defect behind a
    // green run, and the two symptoms have one cause rather than being separate gaps.
    await device.checkCTA('pinnedConversationsOverLimit');
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  await test.step('Assert the seventh pin was refused', async () => {
    // The CTA appearing is not the same as the pin being refused: an app that showed the CTA and pinned
    // anyway satisfies a CTA-only assertion. This is also the iOS half's whole claim, since the CTA
    // check above is Android-only - so it has to be able to fail, which is why `pinTarget` is the last
    // row rather than the first unpinned one.
    assertPinOrder(contactNames, pinnedNames, await getConversationOrder(device));
  });

  const remainingPinned = pinnedNames.slice(1);

  await test.step(`Unpin "${pinnedNames[0]}"`, async () => {
    // Unpinning has to work while over the limit, or the account can never get back under it.
    await device.unpinConversation(pinnedNames[0]);
    await device.waitForTextElementToBePresent(new PlusButton(device));
    await device
      .onAndroid()
      .waitForElementToBeGone(new ConversationPinnedIcon(device, pinnedNames[0]));
  });

  await test.step('Assert the remaining five are still pinned', async () => {
    assertPinOrder(contactNames, remainingPinned, await getConversationOrder(device));
  });

  await test.step('Assert the freed slot cannot be refilled', async () => {
    // Five pinned is AT the limit, not under it, so a standard account may not add a sixth — the same
    // refusal `user_actions_pin_unpin` asserts from below. Together with the step above this says the
    // over-limit state can only drain: unpinning is allowed, re-pinning is not.
    await device.pinConversation(pinTarget);
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
    assertPinOrder(contactNames, remainingPinned, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
