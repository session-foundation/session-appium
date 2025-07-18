import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing video message 1:1',
  risk: 'low',
  testCb: disappearingVideoMessage1o1,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a video disappears as expected in a 1:1 conversation',
});

// Sending and receiving the video can take a while so this is bumped to 60s
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for videos';
const initialMaxWait = 20_000; // Downloading the attachment can take a while
const maxWait = 65_000; // 60s plus buffer

async function disappearingVideoMessage1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  await alice1.onIOS().sendVideoiOS(testMessage);
  await alice1.onAndroid().sendVideoAndroid();
  await bob1.trustAttachments(USERNAME.ALICE);
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          initialMaxWait,
          maxWait,
          text: testMessage,
        })
      )
    );
  } else if (platform === 'android') {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Media message',
          initialMaxWait,
          maxWait,
        })
      )
    );
  }
  await closeApp(alice1, bob1);
}
