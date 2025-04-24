import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after read',
  risk: 'high',
  testCb: disappearAfterRead,
  countOfDevicesNeeded: 2,
});

async function disappearAfterRead(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA, userB },
  } = await open2AppsWithFriendsState({
    platform,
  });

  const testMessage = 'Checking disappear after read is working';
  const mode: DisappearModes = 'read';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  // Click conversation options menu (three dots)
  await setDisappearingMessage(
    platform,
    device1,
    ['1:1', `Disappear after ${mode} option`, time],
    device2
  );
  // Check control message is correct on device 2
  await checkDisappearingControlMessage(
    platform,
    userA.userName,
    userB.userName,
    device1,
    device2,
    time,
    mode
  );
  // Send message to verify that deletion is working
  await device1.sendMessage(testMessage);
  // Need function to read message
  // Wait for 10 seconds
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
