import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing image message to group',
  risk: 'low',
  countOfDevicesNeeded: 3,
  testCb: disappearingImageMessageGroup,
});

async function disappearingImageMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testMessage = 'Testing disappearing messages for images';
  const testGroupName = 'Testing disappearing messages';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const timerType = 'Disappear after send option';
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
      [bob1, charlie1].map(device =>
        device.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Message body',
          text: testMessage,
          maxWait: 4000,
        })
      )
    );
  }
  if (platform === 'android') {
    await Promise.all(
      [bob1, charlie1].map(device =>
        device.waitForTextElementToBePresent({
          strategy: 'accessibility id',
          selector: 'Media message',
          maxWait: 1000,
        })
      )
    );
  }
  // Wait for 30 seconds
  await sleepFor(30000);
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
