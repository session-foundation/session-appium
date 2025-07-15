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
  allureDescription: `Verifies that a GIF disappears as expected in a group conversation`,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';

async function disappearingGifMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Disappear after sent test';
  const testMessage = "Testing disappearing messages for GIF's";
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
  await alice1.sendGIF(testMessage);
  // Cannot use isAndroid() here
  if (platform === 'android') {
    await Promise.all([
      bob1.trustAttachments(testGroupName),
      charlie1.trustAttachments(testGroupName),
    ]);
  }
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 30000,
          text: testMessage,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Media message',
          maxWait: 30000,
        })
      )
    );
  }

  await closeApp(alice1, bob1, charlie1);
}
