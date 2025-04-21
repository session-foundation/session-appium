import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Send document 1:1',
  risk: 'high',
  testCb: sendDocument,
  countOfDevicesNeeded: 2,
});
async function sendDocument(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const testMessage = 'Testing-document-1';
  const replyMessage = `Replying to document from ${userA.userName}`;

  await device1.sendDocument();
  await device2.trustAttachments(userA.userName);
  // Reply to message
  await device2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Document',
  });
  await device2.onIOS().longPressMessage(testMessage);
  await device2.onAndroid().longPress('Document');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app and server
  await closeApp(device1, device2);
}
