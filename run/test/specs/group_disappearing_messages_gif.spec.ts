import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing GIF to group',
  risk: 'low',
  testCb: disappearingGifMessageGroup,
  countOfDevicesNeeded: 3,
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
    await Promise.all([
      bob1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: testMessage,
      }),
      charlie1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: testMessage,
      }),
    ]);
  }
  if (platform === 'android') {
    await Promise.all([
      bob1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
      charlie1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Media message',
      }),
    ]);
  }
  // Wait for 30 seconds
  await sleepFor(30000);
  // Check if GIF has been deleted on both devices
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait: 1000,
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
          maxWait: 1000,
        })
      )
    );
  }

  await closeApp(alice1, bob1, charlie1);
}
