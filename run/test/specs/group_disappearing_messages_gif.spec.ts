import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
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

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const initialMaxWait = 15_000; // Downloading the attachment can take a while
const maxWait = 35_000; // 30s plus buffer

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
  await alice1.sendGIF();
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
        initialMaxWait,
        maxWait,
      })
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
