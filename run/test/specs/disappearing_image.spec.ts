import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
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
  allureDescription: `Verifies that an image disappears as expected in a 1:1 conversation`,
});

const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
const timerType = 'Disappear after send option';
const testMessage = 'Testing disappearing messages for images';
const maxWait = 31_000; // 30s plus buffer

async function disappearingImageMessage1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  await sleepFor(500);
  await alice1.sendImage(testMessage);
  await bob1.trustAttachments(USERNAME.ALICE);
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait,
      text: testMessage,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Message body',
      maxWait,
      text: testMessage,
    }),
  ]);
  await closeApp(alice1, bob1);
}
