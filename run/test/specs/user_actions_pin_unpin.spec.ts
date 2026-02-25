import { test, type TestInfo } from '@playwright/test';
import { USERNAME } from '@session-foundation/qa-seeder';

import { communities } from '../../constants/community';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationPinnedIcon } from '../locators/home';
import { joinCommunity } from '../utils/community';
import { assertPinOrder, getConversationOrder } from '../utils/conversation_order';
import { newUser } from '../utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Pin and unpin conversation',
  risk: 'medium',
  testCb: pinConversationTest,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Pin/Unpin',
  },
  allureDescription:
    'Verifies that pinning moves a conversation to the top of the list and unpinning restores the original order',
});

async function pinConversationTest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Join two communities', async () => {
    await joinCommunity(device, communities.testCommunity.link, communities.testCommunity.name);
    await device.navigateBack();
    await joinCommunity(device, communities.lokinetUpdates.link, communities.lokinetUpdates.name);
    await device.navigateBack();
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
