import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { MediaMessage, MessageBody } from './locators/conversation';
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
const maxWait = 70_000; // 60s plus buffer

async function disappearingVideoMessage1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  let sentTimestamp: number;
  if (platform === 'ios') {
    sentTimestamp = await alice1.onIOS().sendVideoiOS(testMessage);
  } else {
    sentTimestamp = await alice1.onAndroid().sendVideoAndroid();
  }
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new MessageBody(device, testMessage).build(),
          initialMaxWait,
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  } else if (platform === 'android') {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new MediaMessage(device).build(),
          initialMaxWait,
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  }
  await closeApp(alice1, bob1);
}
