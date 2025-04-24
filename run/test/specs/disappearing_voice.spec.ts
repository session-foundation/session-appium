import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing voice message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingVoiceMessage1o1Ios,
  },
  android: {
    testCb: disappearingVoiceMessage1o1Android,
  },
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingVoiceMessage1o1Ios(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  await device1.sendVoiceMessage();
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Voice message',
  });
  await device2.trustAttachments(USERNAME.ALICE);
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Voice message',
      maxWait: 1000,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Voice message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(device1, device2);
}

async function disappearingVoiceMessage1o1Android(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  await setDisappearingMessage(platform, device1, ['1:1', timerType, time], device2);
  await device1.sendVoiceMessage();
  await device2.trustAttachments(USERNAME.ALICE);
  await sleepFor(30000);
  await Promise.all([
    device1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Voice message',
      maxWait: 1000,
    }),
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Voice message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(device1, device2);
}
