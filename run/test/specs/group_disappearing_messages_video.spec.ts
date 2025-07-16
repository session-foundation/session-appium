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

// Sending and receiving the video can take a while so this is bumped to 60s
const time = DISAPPEARING_TIMES.ONE_MINUTE
const timerType = 'Disappear after send option';
const maxWait = 61_000 // 60s plus buffer

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
    [bob1, charlie1].map(device => 
      device.onAndroid().trustAttachments(testGroupName)
  ));
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device => 
        device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        initialMaxWait: 20_000, // Give the clients some more time to download the vid
        maxWait,
        text: testMessage})
      )
    );
  } else if (platform === 'android') {
    await Promise.all(  
    [alice1, bob1, charlie1].map(device => 
        device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
        initialMaxWait: 20_000, // Give the clients some more time to download the vid
        maxWait,
      })
      )
    );
  };
  await closeApp(alice1, bob1, charlie1);
}
