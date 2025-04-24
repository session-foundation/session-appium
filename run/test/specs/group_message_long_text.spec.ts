import { longText } from '../../constants';
import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Send long message to group',
  risk: 'low',
  countOfDevicesNeeded: 3,
  ios: {
    testCb: sendLongMessageGroupiOS,
  },
  android: {
    testCb: sendLongMessageGroupAndroid,
  },
});

async function sendLongMessageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  // Sending a long text message

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  await device1.sendMessage(longText);
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: longText,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: longText,
  });
  const replyMessage = await device2.replyToMessage(userA, longText);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(device1, device2, device3);
}

async function sendLongMessageGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });

  // Sending a long text message
  await device1.inputText(longText, {
    strategy: 'accessibility id',
    selector: 'Message input box',
  });
  // Click send
  await device1.clickOnByAccessibilityID('Send message button');
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: `Message sent status: Sent`,
    maxWait: 50000,
  });

  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: longText,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: longText,
    }),
  ]);
  await device2.longPressMessage(longText);
  await device2.clickOnByAccessibilityID('Reply to message');
  const replyMessage = await device2.sendMessage(`${userA.userName} message reply`);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // TO FIX: REPLY NOT FOUND ANDROID
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app
  await closeApp(device1, device2, device3);
}
