import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
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
});

async function disappearAfterSendNoteToSelf(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  const testMessage = `Testing disappearing messages in Note to Self`;
  const alice = await newUser(device, USERNAME.ALICE);
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Send message to self to bring up Note to Self conversation
  await device.clickOnElementAll(new PlusButton(device));
  await device.clickOnElementAll(new NewMessageOption(device));
  await device.inputText(alice.accountID, new EnterAccountID(device));
  await device.scrollDown();
  await device.clickOnElementAll(new NextButton(device));
  await device.sendMessage(('Buy milk'));
  // Enable disappearing messages
  await setDisappearingMessage(platform, device, [
    'Note to Self',
    'Disappear after send option',
    time,
  ]);
  await sleepFor(1000);
  await device.disappearingControlMessage(
    `You set messages to disappear ${time} after they have been ${controlMode}.`
  );
  await device.sendMessage(testMessage);
  // Sleep time dependent on platform

  await sleepFor(30000);
  await device.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
    maxWait: 1000,
  });
  // Great success
  await closeApp(device);
}
