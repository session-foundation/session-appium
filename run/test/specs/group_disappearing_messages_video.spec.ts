import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { MediaMessage, MessageBody } from '../locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';
import { setDisappearingMessage } from '../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing video to group',
  risk: 'low',
  testCb: disappearingVideoMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a video disappears as expected in a group conversation',
});

// Sending and receiving the video can take a while so this is bumped to 60s
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';
const initialMaxWait = 20_000; // Downloading the attachment can take a while
const maxWait = 70_000; // 60s plus buffer

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
  let sentTimestamp: number;
  if (platform === 'ios') {
    sentTimestamp = await alice1.sendVideoiOS(testMessage);
  } else {
    sentTimestamp = await alice1.sendVideoAndroid();
  }
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementDisappeared({
          ...new MessageBody(device, testMessage).build(),
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  } else if (platform === 'android') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementDisappeared({
          ...new MediaMessage(device).build(),
          initialMaxWait,
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  }
  await closeApp(alice1, bob1, charlie1);
}
