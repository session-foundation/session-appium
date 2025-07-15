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
  allureDescription: `Verifies that a video disappears as expected in a 1:1 conversation`,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for videos';

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
  await bob1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await bob1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });

  // Wait for 30 seconds
  const maxWaitValidateMsgDisappeared = 30000;
  if (platform === 'ios') {
    await Promise.all([
      alice1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        maxWait: maxWaitValidateMsgDisappeared,
        text: testMessage,
      }),
      bob1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        maxWait: maxWaitValidateMsgDisappeared,
        text: testMessage,
      }),
    ]);
  } else if (platform === 'android') {
    await Promise.all([
      alice1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
        maxWait: maxWaitValidateMsgDisappeared,
      }),
      bob1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Media message',
        maxWait: maxWaitValidateMsgDisappeared,
      }),
    ]);
  }
  await closeApp(alice1, bob1);
}
