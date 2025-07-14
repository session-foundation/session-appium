import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
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
  // Wait for 60 seconds
  await sleepFor(60000);
  // Check if GIF has been deleted on both devices
  await alice1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
    text: testMessage,
  });
  await bob1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    maxWait: 1000,
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

  // The UI takes some sime to refresh the component once we click "trust sender", so allow 5s here
  const maxWaitForMediaMessage = 5000;
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: maxWaitForMediaMessage,
    }),
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: maxWaitForMediaMessage,
    }),
  ]);
  // Wait for 60 seconds (time)
  await sleepFor(60000);
  // Check if GIF has been deleted on both devices
  await Promise.all([
    alice1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
    bob1.hasElementBeenDeleted({
      strategy: 'accessibility id',
      selector: 'Media message',
      maxWait: 1000,
    }),
  ]);
  await closeApp(alice1, bob1);
}
