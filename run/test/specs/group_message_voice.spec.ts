import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

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

async function sendVoiceMessageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  const replyMessage = `Replying to voice message from ${userA.userName} in ${testGroupName}`;
  await device1.sendVoiceMessage();
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  await device2.longPress('Voice message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await Promise.all(
    [device1, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function sendVoiceMessageGroupAndroid(platform: SupportedPlatformsType) {
  // open devices
  const testGroupName = 'Message checks for groups';
  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  const replyMessage = `Replying to voice message from ${userA.userName} in ${testGroupName}`;
  // Select voice message button to activate recording state
  await device1.sendVoiceMessage();
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  // Check device 2 and 3 for voice message from user A
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  // Reply to voice message
  await device2.longPress('Voice message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  // Check device 1 and 3 for reply to appear
  await Promise.all(
    [device1, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  await closeApp(device1, device2, device3);
}
