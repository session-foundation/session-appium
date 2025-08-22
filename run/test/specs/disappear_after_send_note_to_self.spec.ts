import type { TestInfo } from '@playwright/test';

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
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const testMessage = `Testing disappearing messages in Note to Self`;
  const alice = await newUser(device, USERNAME.ALICE);
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 35_000; // 30s plus buffer

  // Send message to self to bring up Note to Self conversation
  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new NewMessageOption(device));
  await device.inputText(alice.accountID, new EnterAccountID(device));
  await device.scrollDown();
  await device.clickOnElementAll(new NextButton(device));
  await device.sendMessage('Buy milk');
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
  await device.sendMessage(testMessage);
  await device.hasElementBeenDeleted({
    ...new MessageBody(device, testMessage).build(),
    maxWait,
    preventEarlyDeletion: true,
  });
  // Great success
  await closeApp(device);
}
