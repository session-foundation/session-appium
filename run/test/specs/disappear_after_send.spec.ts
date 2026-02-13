import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, DisappearModes } from '../../types/testing';
import { MessageBody } from '../locators/conversation';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { checkDisappearingControlMessage } from '../utils/disappearing_control_messages';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';
import { setDisappearingMessage } from '../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send',
  risk: 'high',
  testCb: disappearAfterSend,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: `Verifies that 'Disappear After Send' works as expected in a 1:1 conversation`,
});

async function disappearAfterSend(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const mode: DisappearModes = 'send';
  const testMessage = `Checking disappear after ${mode} is working`;
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 35_000; // 30s plus buffer
  // Select disappearing messages option
  await setDisappearingMessage(
    platform,
    alice1,
    ['1:1', `Disappear after ${mode} option`, time],
    bob1
  );
  // Get control message based on key from json file
  await checkDisappearingControlMessage(
    platform,
    alice.userName,
    bob.userName,
    alice1,
    bob1,
    time,
    controlMode
  );
  // Send message to verify that deletion is working
  const sentTimestamp = await alice1.sendMessage(testMessage);
  // Wait for message to disappear
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
