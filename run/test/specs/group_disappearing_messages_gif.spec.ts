import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { MediaMessage } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing GIF to group',
  risk: 'low',
  testCb: disappearingGifMessageGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a GIF disappears as expected in a group conversation',
});

// The timing with 30 seconds was a bit tight in terms of the attachment downloading and becoming visible
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const timerType = 'Disappear after send option';
const initialMaxWait = 15_000; // Downloading the attachment can take a while
const maxWait = 70_000; // 70s plus buffer

async function disappearingGifMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Disappear after sent test';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  // Click on attachments button
  const sentTimestamp = await alice1.sendGIF();
  console.log(`the sent timestamp is ${sentTimestamp}`);
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
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
  await closeApp(alice1, bob1, charlie1);
}
