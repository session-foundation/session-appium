import { test, type TestInfo } from '@playwright/test';

import { ONS_MAPPINGS } from '../../constants';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationHeaderName } from './locators/conversation';
import { PlusButton } from './locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from './locators/start_conversation';
import { newUser } from './utils/create_account';
import { truncatePubkey } from './utils/get_account_id';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'ONS resolution',
  risk: 'high',
  testCb: resolveONS,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'New Conversation',
    suite: 'New Message',
  },
  allureDescription: `Verifies that ONS resolution works`,
});

async function resolveONS(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { ons, pubkey } = ONS_MAPPINGS.TESTQA;
  const expectedPubkey = truncatePubkey(pubkey, platform);

  const device = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device }  = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, false);
    return device;
  });
  await test.step(TestSteps.NEW_CONVERSATION.NEW_MESSAGE, async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
  });
  await test.step(`Enter ONS '${ons}'`, async () => {
    await device.inputText(ons, new EnterAccountID(device));
    await device.clickOnElementAll(new NextButton(device));
  });
  await test.step(`Verify ONS resolution to pubkey '${expectedPubkey}'`, async () => {
    await device.waitForTextElementToBePresent({
      ...new ConversationHeaderName(device).build(expectedPubkey),
      maxWait: 5_000,
    });
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
