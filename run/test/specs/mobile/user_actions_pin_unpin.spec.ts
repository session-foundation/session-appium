import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { getCommunities } from '../../../constants/community';
import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CTAButtonNegative } from '../../locators/global';
import { ConversationPinnedIcon, PlusButton } from '../../locators/home';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { joinCommunities } from '../../utils/community';
import { assertPinOrder, getConversationOrder } from '../../utils/conversation_order';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { observeProGrant } from '../../utils/pro_refresh';

/** The pinned-conversation limit for a standard account. */
const STANDARD_PIN_LIMIT = 5;

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
  allureDescription: 'Verifies that a standard user can only pin 5 conversations',
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
  const numCommunities = 2;
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(numCommunities), async () => {
    await joinCommunities(device, numCommunities);
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
  const communities = getCommunities();
  const numCommunities = 6;
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(numCommunities), async () => {
    await joinCommunities(device, numCommunities);
  });
  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });
  const toPin = Object.values(communities)
    .slice(0, STANDARD_PIN_LIMIT)
    .map(community => community.name);
  const overLimit = Object.values(communities)[STANDARD_PIN_LIMIT].name;

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(STANDARD_PIN_LIMIT), async () => {
    for (const name of toPin) {
      await device.pinConversation(name);
      await device.waitForTextElementToBePresent(new PlusButton(device));
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
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });
  await test.step('Assert the over-limit conversation was NOT pinned', async () => {
    // The CTA appearing is not the same as the pin being refused: an app that showed the CTA and
    // pinned anyway satisfies a CTA-only assertion.
    assertPinOrder(beforeOrder, toPin, await getConversationOrder(device));
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proPinnedLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const communities = getCommunities();
  const numCommunities = 6;
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  await makeAccountPro({ user: alice, platform });
  await observeProGrant(device);
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(numCommunities), async () => {
    await joinCommunities(device, numCommunities);
  });
  let beforeOrder: string[] = [];
  await test.step('Capture conversation order before pinning', async () => {
    beforeOrder = await getConversationOrder(device);
  });
  const toPin = Object.values(communities)
    .slice(0, numCommunities)
    .map(community => community.name);

  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(numCommunities), async () => {
    for (const name of toPin) {
      await device.pinConversation(name);
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, name));
      await device.waitForTextElementToBePresent(new PlusButton(device));
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
