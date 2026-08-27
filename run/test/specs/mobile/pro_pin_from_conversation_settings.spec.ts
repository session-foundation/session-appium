import { test, type TestInfo } from '@playwright/test';

import { STANDARD_PIN_LIMIT } from '../../../shared/constants';
import { TestSteps } from '../../../types/allure';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationSettings, PinConversationSettingsOption } from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { ConversationItem, PlusButton } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';

bothPlatformsIt({
  title: 'Pinned conversation limit from conversation settings (non Pro)',
  risk: 'high',
  testCb: pinLimitFromConversationSettings,
  countOfDevicesNeeded: 1,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'The pinned-conversation limit holds when the pin is attempted from a conversation’s settings ' +
    'screen rather than from the conversation list.',
});

/**
 * The second call site of the pinned-conversation limit.
 *
 * One rule, two implementations: the conversation list's swipe/long-press action has its own, and
 * `ThreadSettingsViewModel.toggleConversationPinnedStatus` counts the pinned conversations and raises
 * the CTA itself rather than calling into the list's. Every existing pin spec drives the list route, so
 * a limit that is correct there and absent here passes the whole suite — and this route has already had
 * to be fixed once for exactly that reason.
 *
 * Both directions are asserted, because the two failures are opposite and a spec that only checked the
 * refusal would pass against a settings route that never pinned anything at all:
 *
 *   - the route pins  — the first pin is made here, and has to take effect
 *   - the route stops — the sixth is attempted here, must raise the CTA and must NOT pin
 *
 * The four pins in between go through the conversation list, which is already covered and is much the
 * faster route: what is under test is the limit check at this call site, not the act of pinning five
 * times.
 */
async function pinLimitFromConversationSettings(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const { device, contactNames } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await open_Alice1_with_contacts({
      platform,
      testInfo,
      testContext: PRO_BACKEND_CONTEXT,
    });
  });

  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });

  // Deliberately NOT the first N. `assertPinOrder` expects the pinned names hoisted to the top of the
  // order they already had, so pinning a PREFIX of an already-ordered list expects the list unchanged —
  // and the assertion then passes whether or not anything was pinned. Skipping the first contact is
  // what makes the expected order differ from the starting one, and the assertion able to fail.
  const toPin = contactNames.slice(1, STANDARD_PIN_LIMIT + 1);
  const [firstViaSettings, ...restViaList] = toPin;
  const overLimit = contactNames[STANDARD_PIN_LIMIT + 1];

  await test.step('The settings route pins', async () => {
    await pinFromConversationSettings(device, firstViaSettings);
    await returnToConversationList(device);
  });

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(restViaList.length), async () => {
    for (const name of restViaList) {
      await device.pinConversation(name);
      await device.waitForTextElementToBePresent(new PlusButton(device));
    }
  });

  await test.step('Assert the allowed pins took effect', async () => {
    // Includes the one made from the settings screen, so this is what proves that route pins at all.
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Pinned Conversations CTA'), async () => {
    await pinFromConversationSettings(device, overLimit);
    await device.checkCTA('pinnedConversations');
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  await test.step('Assert the over-limit conversation was NOT pinned', async () => {
    // The CTA appearing is not the same as the pin being refused: a route that showed the CTA and
    // pinned anyway satisfies a CTA-only assertion.
    await returnToConversationList(device);
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * Walk back until the conversation list is on screen.
 *
 * The settings screen sits two levels deep — list, conversation, settings — but how far one `back` goes
 * is not the same in both directions: tapping the pin row can dismiss the settings screen itself, so a
 * fixed number of them lands on the conversation on one path and the list on the other. Measured, not
 * assumed: a single `back` after pinning left the app in `ConversationVC`.
 */
async function returnToConversationList(device: DeviceWrapper) {
  for (let i = 0; i < 3; i++) {
    if (await device.doesElementExist({ ...new PlusButton(device).build(), maxWait: 1000 })) {
      return;
    }
    await device.navigateBack();
  }
  await device.waitForTextElementToBePresent(new PlusButton(device));
}

/** Open `name`, open its settings, and tap the pin row. Leaves the settings screen open. */
async function pinFromConversationSettings(device: DeviceWrapper, name: string) {
  await device.clickOnElementAll(new ConversationItem(device, name));
  await device.clickOnElementAll(new ConversationSettings(device));
  await device.clickOnElementAll(new PinConversationSettingsOption(device));
}
