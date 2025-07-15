import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing video to group',
  risk: 'low',
  testCb: disappearingVideoMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that a video disappears as expected in a group conversation`,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingVideoMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testMessage = 'Testing disappearing messages for videos';
  const testGroupName = 'Testing disappearing messages';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  await alice1.onIOS().sendVideoiOS(testMessage);
  await alice1.onAndroid().sendVideoAndroid();
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        maxWait: 3000,
        text: testMessage,
      })
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
