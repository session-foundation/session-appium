import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES } from '../../types/testing';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { setDisappearingMessage } from './utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send groups',
  risk: 'high',
  testCb: disappearAfterSendGroups,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription: `Verifies that 'Disappear After Send' works as expected in a group conversation`,
});

async function disappearAfterSendGroups(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Disappear after send test';
  const testMessage = 'Testing disappear after sent in groups';
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 32_000; // 30s plus buffer
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });

  await setDisappearingMessage(platform, alice1, ['Group', `Disappear after send option`, time]);
  // Get correct control message for You setting disappearing messages
  const disappearingMessagesSetYou = englishStrippedStr('disappearingMessagesSetYou')
    .withArgs({ time, disappearing_messages_type: controlMode })
    .toString();
  // Get correct control message for alice setting disappearing messages
  const disappearingMessagesSetControl = englishStrippedStr('disappearingMessagesSet')
    .withArgs({ name: alice.userName, time, disappearing_messages_type: controlMode })
    .toString();
  // Check control message is correct on device 1, 2 and 3
  await Promise.all([
    alice1.disappearingControlMessage(disappearingMessagesSetYou),
    bob1.disappearingControlMessage(disappearingMessagesSetControl),
    charlie1.disappearingControlMessage(disappearingMessagesSetControl),
  ]);
  // Check for test messages (should be deleted)
  await alice1.sendMessage(testMessage);
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
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}
