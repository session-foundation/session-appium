import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing image message to group',
  risk: 'low',
  countOfDevicesNeeded: 3,
  testCb: disappearingImageMessageGroup,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that an image disappears as expected in a group conversation`,
});

async function disappearingImageMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testMessage = 'Testing disappearing messages for images';
  const testGroupName = 'Testing disappearing messages';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
  const maxWait = 31_000 // 30s plus buffer
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  await setDisappearingMessage(platform, alice1, ['Group', timerType, time]);
  // await device1.navigateBack();
  await alice1.sendImage(testMessage);
  await Promise.all([
    bob1.onAndroid().trustAttachments(testGroupName),
    charlie1.onAndroid().trustAttachments(testGroupName),
  ]);
  if (platform === 'ios') {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementBeenDeleted({
          strategy: 'accessibility id',
          selector: 'Message body',
          maxWait,
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
          maxWait,
        })
      )
    );
  }
  await closeApp(alice1, bob1, charlie1);
}
