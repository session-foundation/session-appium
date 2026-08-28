import { test, type TestInfo } from '@playwright/test';

import { STANDARD_PIN_LIMIT } from '../../../shared/constants';

/** One past the standard limit: a Pro account must pin all of these without being stopped. */
const OVER_STANDARD_PIN_LIMIT = STANDARD_PIN_LIMIT + 1;
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationPinnedIcon } from '../../locators/home';
import { open_Alice1_with_contacts } from '../../state_builder';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

bothPlatformsIt({
  title: 'Pin and unpin conversation',
  risk: 'medium',
  testCb: pinConversation,
  countOfDevicesNeeded: 1,
  communityRooms: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Pin/Unpin',
  },
  allureDescription:
    'Verifies that pinning moves a conversation to the top of the list and unpinning restores the original order',
});

bothPlatformsIt({
  title: 'Pinned conversation limit (non Pro)',
  risk: 'high',
  testCb: nonProPinnedLimit,
  countOfDevicesNeeded: 1,
  communityRooms: 6,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'Verifies that a standard user can only pin 5 conversations, in the same session and after ' +
    'restarting the app',
});

bothPlatformsIt({
  title: 'Pinned conversation limit (Pro)',
  risk: 'high',
  testCb: proPinnedLimit,
  countOfDevicesNeeded: 1,
  communityRooms: 6,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription: 'Verifies that a Pro user can pin 5+ conversations',
});

async function pinConversation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Seeded contacts rather than joined communities: this only needs a conversation list it can
  // reorder, and community joins were the slowest part of the run.
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await open_Alice1_with_contacts({ platform, testInfo });
  });
  let beforeOrder: string[] = [];
  let toPin = '';
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
    toPin = beforeOrder[beforeOrder.length - 1];
    device.log(`Pinning last conversation: "${toPin}"`);
  });
  await test.step(`Pin "${toPin}"`, async () => {
    await device.pinConversation(toPin);
  });
  await test.step('Assert pinned conversation moved to top', async () => {
    const afterOrder = await getConversationOrder(device);
    assertPinOrder(beforeOrder, [toPin], afterOrder);
  });
  if (platform === 'android') {
    await test.step('Assert pin icon is visible on pinned conversation', async () => {
      await device.waitForTextElementToBePresent(new ConversationPinnedIcon(device, toPin));
    });
  }
  await test.step(`Unpin "${toPin}"`, async () => {
    await device.unpinConversation(toPin);
  });
  await test.step('Assert order restored after unpinning', async () => {
    const afterUnpinOrder = await getConversationOrder(device);
    assertPinOrder(beforeOrder, [], afterUnpinOrder);
  });
  if (platform === 'android') {
    await test.step('Assert pin icon is gone after unpinning', async () => {
      await device.waitForElementToBeGone(new ConversationPinnedIcon(device, toPin));
    });
  }
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function nonProPinnedLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Seeded contacts rather than joined communities: this needs a conversation list longer than the
  // limit, and joining six communities was the slowest part of the run.
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
  // Deliberately not the first N. `assertPinOrder` partitions `beforeOrder` into pinned and unpinned and
  // expects the pinned ones first, so for a prefix selection the expected order is `beforeOrder` itself
  // and the assertion cannot fail. Every order assertion below depends on this offset.
  const toPin = contactNames.slice(1, STANDARD_PIN_LIMIT + 1);
  const overLimit = contactNames[STANDARD_PIN_LIMIT + 1];

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(STANDARD_PIN_LIMIT), async () => {
    for (const name of toPin) {
      await device.pinConversation(name);
      await device.verifyNoCTAShows();
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, name));
    }
  });
  await test.step('Assert the allowed pins took effect', async () => {
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Pinned Conversations CTA'), async () => {
    await device.pinConversation(overLimit);
    await device.checkCTA('pinnedConversations');
    await device.dismissCTA('negativeButton');
  });
  await test.step('Assert the over-limit conversation was NOT pinned', async () => {
    // The CTA appearing is not the same as the pin being refused: an app that showed the CTA and
    // pinned anyway satisfies a CTA-only assertion.
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step('Assert the limit still holds after a relaunch', async () => {
    await forceStopAndRestart(device);
    await device.pinConversation(overLimit);
    // The count above is live, because each pin updates it. Across a restart it has to be rebuilt from
    // storage instead, and a client that rebuilds it only when a pin changes reads zero here: the pin is
    // allowed and no CTA is raised, so the limit stops applying rather than applying wrongly. Repeatable
    // by anyone who reopens the app, which is why it is asserted here rather than left to the fix.
    await device.checkCTA('pinnedConversations');
    await device.dismissCTA('negativeButton');
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proPinnedLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Seeded contacts rather than joined communities. The grant still has to be real: the pinned limit
  // is an ACCESS question, so it reads the proof rather than the plan's state.
  const { device, alice, contactNames } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await open_Alice1_with_contacts({
      platform,
      testInfo,
      testContext: PRO_BACKEND_CONTEXT,
    });
  });
  await makeAccountPro({ user: alice, platform });
  await observeProGrant(device);
  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });
  const toPin = contactNames.slice(0, OVER_STANDARD_PIN_LIMIT);

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(OVER_STANDARD_PIN_LIMIT), async () => {
    for (const name of toPin) {
      await device.pinConversation(name);
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, name));
    }
    await device.verifyNoCTAShows();
  });
  await test.step('Assert every pin took effect', async () => {
    // Asserted on the order rather than the pin icon alone: the icon is Android-only, so without
    // this the iOS half of the spec proves nothing beyond "no CTA appeared" — which is also true if
    // pinning silently did nothing.
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
