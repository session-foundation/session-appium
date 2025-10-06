import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody, VoiceMessage } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send voice message to group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: sendVoiceMessageGroup,
});

async function sendVoiceMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  const replyMessage = `Replying to voice message from ${alice.userName} in ${testGroupName}`;
  await alice1.sendVoiceMessage();
  await Promise.all(
    [bob1, charlie1].map(device => device.onAndroid().trustAttachments(testGroupName))
  );
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new VoiceMessage(device))
    )
  );
  await bob1.longPress(new VoiceMessage(bob1));
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, replyMessage))
    )
  );
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}
