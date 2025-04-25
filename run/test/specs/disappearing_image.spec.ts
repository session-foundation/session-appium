import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing image message 1:1',
  risk: 'low',
  testCb: disappearingImageMessage1o1,
  countOfDevicesNeeded: 2,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for images';

async function disappearingImageMessage1o1(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  await sleepFor(500);
  await device1.sendImage(platform, testMessage);
  await device2.trustAttachments(USERNAME.ALICE);
  // Wait for 30 seconds
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testMessage,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait: 1000,
      text: testMessage,
    }),
  ]);
  await closeApp(device1, device2);
}
