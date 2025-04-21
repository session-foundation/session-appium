import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { sleepFor } from './utils';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';
import { open2AppsWithFriendsState } from './state_builder';

bothPlatformsIt({
  title: 'Disappear after send',
  risk: 'high',
  testCb: disappearAfterSend,
  countOfDevicesNeeded: 2,
});

async function disappearAfterSend(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA, userB },
  } = await open2AppsWithFriendsState({
    platform,
  });

  const mode: DisappearModes = 'send';
  const testMessage = `Checking disappear after ${mode} is working`;
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    device1,
    ['1:1', `Disappear after ${mode} option`, time],
    device2
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    userA.userName,
    userB.userName,
    device1,
    device2,
    time,
    controlMode
  );
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  await device2.clickOnElementByText({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  // Wait for message to disappear
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
      maxWait: 5000,
    }),
  ]);

  // Great success
  await closeApp(device1, device2);
}
