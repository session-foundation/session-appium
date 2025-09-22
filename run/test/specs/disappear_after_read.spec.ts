import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { checkDisappearingControlMessage } from './utils/disappearing_control_messages';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after read',
  risk: 'high',
  testCb: disappearAfterRead,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: `Verifies that 'Disappear After Read' can be set in a 1:1 conversation, and that a message disappears after the specified expiry time.`,
});

async function disappearAfterRead(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    testInfo,
    focusFriendsConvo: true,
  });

  const testMessage = 'Checking disappear after read is working';
  const mode: DisappearModes = 'read';
  // TODO: Consider refactoring DISAPPEARING_TIMES to include ms values
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 35_000; // 30s plus buffer
  // Click conversation options menu (three dots)
  await setDisappearingMessage(
    platform,
    alice1,
    ['1:1', `Disappear after ${mode} option`, time],
    bob1
  );
  // Check control message is correct on device 2
  await checkDisappearingControlMessage(
    platform,
    alice.userName,
    bob.userName,
    alice1,
    bob1,
    time,
    mode
  );
  // Send message to verify that deletion is working
  const sentTimestamp = await alice1.sendMessage(testMessage);
  // NOTE  we're only sending a text message, both devices are open, DaS is practically the same as DaR
  await Promise.all(
    [alice1, bob1].map(device =>
      device.hasElementDisappeared({
        ...new MessageBody(device, testMessage).build(),
        maxWait,
        actualStartTime: sentTimestamp,
      })
    )
  );
  // Great success
  await closeApp(alice1, bob1);
}
