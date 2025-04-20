import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt('Disappearing video message 1:1', 'low', disappearingVideoMessage1o1);

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for videos';

async function disappearingVideoMessage1o1(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  await device1.onIOS().sendVideoiOS(testMessage);
  await device1.onAndroid().sendVideoAndroid();
  await device2.trustAttachments(USERNAME.ALICE);
  await device2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });

  // Wait for 30 seconds
  await sleepFor(30000);
  if (platform === 'ios') {
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
  }
  if (platform === 'android') {
    await Promise.all([
      device1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
      device2.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
    ]);
  }
  await closeApp(device1, device2);
}
