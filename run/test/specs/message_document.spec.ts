import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { DocumentMessage, MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
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
  await bob1.onIOS().longPressMessage(new MessageBody(bob1, testMessage));
  await bob1.onAndroid().longPressMessage(new DocumentMessage(bob1));
  await bob1.clickOnByAccessibilityID('Reply to message');
  await sleepFor(500); // Let the UI settle before finding message input and typing
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app and server
  await closeApp(alice1, bob1);
}
