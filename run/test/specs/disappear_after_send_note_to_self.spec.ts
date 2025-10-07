import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { MessageBody } from './locators/conversation';
import { PlusButton } from './locators/home';
import { EnterAccountID, NewMessageOption, NextButton } from './locators/start_conversation';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send note to self',
  risk: 'medium',
  testCb: disappearAfterSendNoteToSelf,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription:
    'Verifies that Disappearing Messages can be set in Note to Self, and that a message disappears after the specified expiry time.',
});

async function disappearAfterSendNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testMessage = `Testing disappearing messages in Note to Self`;
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 35_000; // 30s plus buffer
  let sentTimestamp: number;

  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    const alice = await newUser(device, USERNAME.ALICE);
    return { device, alice };
  });
  // Send message to self to bring up Note to Self conversation
  await test.step(TestSteps.OPEN.NTS, async () => {
    await device.clickOnElementAll(new PlusButton(device));
    await device.clickOnElementAll(new NewMessageOption(device));
    await device.inputText(alice.accountID, new EnterAccountID(device));
    await device.scrollDown();
    await device.clickOnElementAll(new NextButton(device));
  });
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET(time), async () => {
    // Enable disappearing messages
    await setDisappearingMessage(platform, device, [
      'Note to Self',
      'Disappear after send option',
      time,
    ]);
    await sleepFor(1000);
    await device.waitForControlMessageToBePresent(
      `You set messages to disappear ${time} after they have been ${controlMode}.`
    );
  });
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, 'Note to Self'), async () => {
    sentTimestamp = await device.sendMessage(testMessage);
  });
  await test.step(TestSteps.VERIFY.DISAPPEARING_CONTROL_MESSAGES, async () => {
    await device.hasElementDisappeared({
      ...new MessageBody(device, testMessage).build(),
      maxWait,
      actualStartTime: sentTimestamp,
    });
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    // Great success
    await closeApp(device);
  });
}
