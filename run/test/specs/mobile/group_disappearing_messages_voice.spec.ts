import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../../types/sessionIt';
import { GROUPNAME } from '../../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import {
  getDisappearingTestTime,
  getDisappearingTestTiming,
  setDisappearingMessage,
} from '../../utils/set_disappearing_messages';

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
  const time = getDisappearingTestTime();
  const timerType = 'Disappear after send option';
  const { expectedDuration, maxWait } = getDisappearingTestTiming();
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await setDisappearingMessage(alice1, ['Group', timerType, time]);
  const sentTimestamp = await alice1.sendVoiceMessage();
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.hasElementDisappeared({
        strategy: 'accessibility id',
        selector: 'Voice message',
        maxWait,
        expectedDuration,
        actualStartTime: sentTimestamp,
      })
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
