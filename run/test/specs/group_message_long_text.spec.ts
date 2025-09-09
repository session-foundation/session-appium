import type { TestInfo } from '@playwright/test';

import { longText } from '../../constants';
import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send long message to group',
  risk: 'low',
  countOfDevicesNeeded: 3,
  testCb: sendLongMessageGroup,
  allureDescription: 'Verifies that a long message can be sent to a group',
});

async function sendLongMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';
  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await alice1.sendMessage(longText);
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, longText))
    )
  );
  const replyMessage = await bob1.replyToMessage(alice, longText);
  await Promise.all(
    [alice1, charlie1].map(async device => {
      await device.scrollToBottom();
      await device.waitForTextElementToBePresent(new MessageBody(device, replyMessage));
    })
  );
  // Close app
  await closeApp(alice1, bob1, charlie1);
}
