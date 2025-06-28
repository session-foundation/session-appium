import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import type { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Send document 1:1',
  risk: 'high',
  testCb: sendDocument,
  countOfDevicesNeeded: 2,
});
async function sendDocument(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const testMessage = 'Testing-document-1';
  const replyMessage = `Replying to document from ${alice.userName}`;

  await alice1.sendDocument();
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await bob1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Document',
  });
  await bob1.onIOS().longPressMessage(testMessage);
  await bob1.onAndroid().longPress('Document');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close app and server
  await closeApp(alice1, bob1);
}
