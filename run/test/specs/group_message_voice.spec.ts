import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsItSeparate({
  title: 'Send voice message to group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendVoiceMessageGroupiOS,
  },
  android: {
    testCb: sendVoiceMessageGroupAndroid,
  },
});

async function sendVoiceMessageGroupiOS(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  await bob1.longPress('Voice message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  // Close server and devices
  await closeApp(alice1, bob1, charlie1);
}

async function sendVoiceMessageGroupAndroid(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // open devices
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
  // Select voice message button to activate recording state
  await alice1.sendVoiceMessage();
  await Promise.all([
    bob1.trustAttachments(testGroupName),
    charlie1.trustAttachments(testGroupName),
  ]);
  // Check device 2 and 3 for voice message from user A
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  // Reply to voice message
  await bob1.longPress('Voice message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  // Check device 1 and 3 for reply to appear
  await Promise.all(
    [alice1, charlie1].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
