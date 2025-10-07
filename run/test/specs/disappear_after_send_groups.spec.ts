import { test, type TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES } from '../../types/testing';
import { MessageBody } from './locators/conversation';
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
  allureDescription:
    'Verifies that Disappearing Messages can be set in a group conversation, and that a message disappears after the specified expiry time.',
});

async function disappearAfterSendGroups(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Disappear after send test';
  const testMessage = 'Testing disappear after sent in groups';
  const controlMode: DisappearActions = 'sent';
  const time = DISAPPEARING_TIMES.THIRTY_SECONDS;
  const maxWait = 35_000; // 30s plus buffer
  let sentTimestamp: number;
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_Charlie1_friends_group({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo,
    });
  });
  await test.step(TestSteps.DISAPPEARING_MESSAGES.SET(time), async () => {
    await setDisappearingMessage(platform, alice1, ['Group', `Disappear after send option`, time]);
  });
  await test.step(TestSteps.VERIFY.DISAPPEARING_CONTROL_MESSAGES, async () => {
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
      alice1.waitForControlMessageToBePresent(disappearingMessagesSetYou),
      bob1.waitForControlMessageToBePresent(disappearingMessagesSetControl),
      charlie1.waitForControlMessageToBePresent(disappearingMessagesSetControl),
    ]);
  });
  // Check for test messages (should be deleted)
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, testGroupName), async () => {
    sentTimestamp = await alice1.sendMessage(testMessage);
  });
  await test.step(TestSteps.VERIFY.MESSAGE_DISAPPEARED, async () => {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.hasElementDisappeared({
          ...new MessageBody(device, testMessage).build(),
          maxWait,
          actualStartTime: sentTimestamp,
        })
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1);
  });
}
