import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, GROUPNAME } from '../../types/testing';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing voice message to group',
  risk: 'low',
  testCb: disappearingVoiceMessageGroup,
  countOfDevicesNeeded: 3,
});

async function disappearingVoiceMessageGroup(platform: SupportedPlatformsType) {
  const testGroupName: GROUPNAME = 'Testing voice';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  await setDisappearingMessage(platform, device1, ['Group', timerType, time]);
  await device1.sendVoiceMessage();
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Voice message',
  });
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
    device2.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Voice message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(device1, device2, device3);
}
