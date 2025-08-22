import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Send GIF 1:1',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  testCb: sendGif,
});

async function sendGif(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const replyMessage = `Replying to GIF from ${alice.userName}`;
  await alice1.sendGIF();
  await bob1.trustAttachments(alice.userName);
  // Reply to message
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Media message',
  });
  await bob1.longPress('Media message');
  await bob1.clickOnByAccessibilityID('Reply to message');
  await bob1.sendMessage(replyMessage);
  await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
  // Close app
  await closeApp(alice1, bob1);
}
