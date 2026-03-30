import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { communities } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationPinnedIcon, PlusButton } from '../locators/home';
import { IOS_PRO_CONTEXT } from '../utils/capabilities_ios';
import { joinCommunities } from '../utils/community';
import { assertPinOrder, getConversationOrder } from '../utils/conversation_order';
import { newUser } from '../utils/create_account';
import { makeAccountPro } from '../utils/mock_pro';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';
import { forceStopAndRestart } from '../utils/utilities';

bothPlatformsIt({
  title: 'Pin and unpin conversation',
  risk: 'medium',
  testCb: pinConversation,
  countOfDevicesNeeded: 1,
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
      await device.verifyElementNotPresent(new ConversationPinnedIcon(device, toPin));
    });
  }
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function nonProPinnedLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const numCommunities = 6;
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(numCommunities), async () => {
    await joinCommunities(device, numCommunities);
  });
  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(numCommunities), async () => {
    let pinned = 0;
    for (const community of Object.values(communities).slice(0, numCommunities)) {
      await device.pinConversation(community.name);
      pinned++;
      if (pinned < numCommunities) {
        await device.waitForTextElementToBePresent(new PlusButton(device));
        await device.verifyNoCTAShows();
        await device
          .onAndroid()
          .waitForTextElementToBePresent(new ConversationPinnedIcon(device, community.name));
      } else {
        await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Pinned Conversations CTA'), async () => {
          await device.checkCTA('pinnedConversations');
        });
      }
    }
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proPinnedLimit(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const numCommunities = 6;
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, IOS_PRO_CONTEXT);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  await makeAccountPro({ user: alice, platform });
  await forceStopAndRestart(device);
  await device.dismissCTA();
  await test.step(TestSteps.NEW_CONVERSATION.JOIN_COMMUNITIES(numCommunities), async () => {
    await joinCommunities(device, numCommunities);
  });
  await test.step(TestSteps.USER_ACTIONS.PIN_CONVERSATIONS(numCommunities), async () => {
    for (const community of Object.values(communities).slice(0, numCommunities)) {
      await device.pinConversation(community.name);
      await device
        .onAndroid()
        .waitForTextElementToBePresent(new ConversationPinnedIcon(device, community.name));
      await device.waitForTextElementToBePresent(new PlusButton(device));
    }
    await device.verifyNoCTAShows();
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
