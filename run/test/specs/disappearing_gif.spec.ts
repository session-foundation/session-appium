import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, USERNAME } from '../../types/testing';
import { MediaMessage } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappearing GIF message 1:1',
  risk: 'low',
  countOfDevicesNeeded: 2,
  testCb: disappearingGifMessage1o1,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Message Types',
  },
  allureDescription: 'Verifies that a GIF disappears as expected in a 1:1 conversation',
});

// The timing with 30 seconds was a bit tight in terms of the attachment downloading and becoming visible
const time = DISAPPEARING_TIMES.ONE_MINUTE;
const initialMaxWait = 15_000; // GIFs could be large so give them a bit more time to be found
const maxWait = 70_000; // 70s plus buffer
const timerType = 'Disappear after send option';

async function disappearingGifMessage1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  await setDisappearingMessage(platform, alice1, ['1:1', timerType, time], bob1);
  await alice1.sendGIF();
  await bob1.trustAttachments(USERNAME.ALICE);
  await Promise.all(
    [alice1, bob1].map(device =>
      device.hasElementBeenDeleted({
        ...new MediaMessage(device).build(),
        initialMaxWait,
        maxWait,
        preventEarlyDeletion: true,
      })
    )
  );
  await closeApp(alice1, bob1);
}
