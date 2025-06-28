import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { sleepFor } from './utils';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { open_Alice1_Bob1_friends } from './state_builder';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Disappear after send',
  risk: 'high',
  testCb: disappearAfterSend,
  countOfDevicesNeeded: 2,
});

async function disappearAfterSend(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });

  const mode: DisappearModes = 'send';
  const testMessage = `Checking disappear after ${mode} is working`;
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    alice1,
    ['1:1', `Disappear after ${mode} option`, time],
    bob1
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    alice.userName,
    bob.userName,
    alice1,
    bob1,
    time,
    controlMode
  );
  // Send message to verify that deletion is working
  await alice1.sendMessage(testMessage);
  await bob1.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Wait for message to disappear
  await sleepFor(30000);
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
  ]);

  // Great success
  await closeApp(alice1, bob1);
}
