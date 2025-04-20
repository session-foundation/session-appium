import { androidIt, iosIt } from '../../types/sessionIt';
import { open3AppsWithFriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

iosIt('Send document to group', 'high', sendDocumentGroupiOS);
androidIt('Send document to group', 'high', sendDocumentGroupAndroid);

async function sendDocumentGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWithFriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  const testMessage = 'Testing-document-1';
  const replyMessage = `Replying to document from ${userA.userName}`;

  await device1.sendDocument();
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: testMessage,
    }),
  ]);
  await device2.longPressMessage(testMessage);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await closeApp(device1, device2, device3);
}

async function sendDocumentGroupAndroid(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const {
    devices: { device1, device2, device3 },
    prebuilt: { userA },
  } = await open3AppsWithFriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });

  const replyMessage = `Replying to document from ${userA.userName} in ${testGroupName}`;
  await device1.sendDocument();
  // Reply to message
  await sleepFor(1000);
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  // Check document appears in both device 2 and 3's screen
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Document',
    }),
    await device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Document',
    }),
  ]);
  // Reply to document from user B
  await device2.longPress('Document');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  // Check reply from device 2 came through on device1 and device3
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  // Close app and server
  await closeApp(device1, device2, device3);
}
