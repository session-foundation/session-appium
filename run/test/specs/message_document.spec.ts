import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

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
  const testMessage = 'Testing documents';
  const replyMessage = `Replying to document from ${alice.userName}`;

  await alice1.sendDocument();
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.onIOS().waitForTextElementToBePresent(new MessageBody(bob1, testMessage));
  await bob1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Document',
  });
  await bob1.onIOS().longPressMessage(testMessage);
  await bob1.onAndroid().longPress('Document');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app and server
  await closeApp(alice1, bob1);
}
