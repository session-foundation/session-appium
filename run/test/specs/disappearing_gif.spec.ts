import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsItSeparate({
  title: 'Disappearing GIF message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: disappearingGifMessage1o1Ios,
  },
  android: {
    testCb: disappearingGifMessage1o1Android,
  },
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: `Verifies that a GIF disappears as expected in a 1:1 conversation`,
});

// The timing with 30 seconds was a bit tight in terms of the attachment downloading and becoming visible
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const maxWait = 65_000; // 60s plus buffer
const timerType = 'Disappear after send option';
const testMessage = "Testing disappearing messages for GIF's";

async function disappearingGifMessage1o1Ios(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testMessage = "Testing disappearing messages for GIF's";
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Click on attachments button
  await alice1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(USERNAME.ALICE);
  // Check if GIF has been deleted on both devices
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait,
    text: testMessage,
  });
  await bob1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait,
    text: testMessage,
  });
  await closeApp(alice1, bob1);
}

async function disappearingGifMessage1o1Android(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  // Wait for control messages to disappear before sending image
  // (to check if the control messages are interfering with finding the untrusted attachment message)
  // Click on attachments button
  await alice1.sendGIF(testMessage);
  // Check if the 'Tap to download media' config appears
  // Click on config
  await bob1.trustAttachments(USERNAME.ALICE);
  // Check if GIF has been deleted on both devices
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait,
    }),
  ]);
  await closeApp(alice1, bob1);
}
