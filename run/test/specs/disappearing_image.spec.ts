import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { MediaMessage, MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing image message 1:1',
  risk: 'low',
  testCb: disappearingImageMessage1o1,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that an image disappears as expected in a 1:1 conversation',
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for images';
const maxWait = 35_000; // 30s plus buffer

async function disappearingImageMessage1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  const sentTimestamp = await alice1.sendImage(testMessage);
  await bob1.trustAttachments(alice.userName);
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new MessageBody(device, testMessage).build(),
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  } else {
    await Promise.all(
      [alice1, bob1].map(device =>
        device.hasElementDisappeared({
          ...new MediaMessage(device).build(),
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  }
  await closeApp(alice1, bob1);
}
