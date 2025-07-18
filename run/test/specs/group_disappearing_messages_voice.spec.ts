import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, GROUPNAME } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing voice message to group',
  risk: 'low',
  testCb: disappearingVoiceMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a voice note disappears as expected in a group conversation',
});

async function disappearingVoiceMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName: GROUPNAME = 'Testing voice';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
  const maxWait = 35_000; // 30s plus buffer
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  await alice1.sendVoiceMessage();
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Voice message',
        maxWait,
      })
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
