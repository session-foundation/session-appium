import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import {
  MessageBody,
  MessageInput,
  OutgoingMessageStatusSent,
  SendButton,
} from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { MessageBodyScreenshot } from './utils/screenshot_paths';
import { verifyElementScreenshot } from './utils/verify_screenshots';

bothPlatformsIt({
  title: 'Check message bubble layout',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: messageBubbleAppearance,
  allureSuites: {
    parent: 'Visual Checks',
    suite: 'Conversation',
  },
  allureDescription: `Verifies that message bubbles appear as expected (oneline and multiline messages, reply layout, outgoing/incoming)`,
});

async function messageBubbleAppearance(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: true,
      testInfo,
    });
  });
  // Alice sends a short message to Bob and Bob replies with a longer message
  // This lets us verify four different message bubbles
  const shortMessage = 'This is a short message';
  const replyMessage =
    'This is a longer reply message that is likely to span multiple lines which is great for testing';

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, bob.userName), async () => {
    await alice1.sendMessage(shortMessage);
    await alice1.waitForTextElementToBePresent(new MessageBody(alice1, shortMessage));
  });
  await test.step(TestSteps.VERIFY.SCREENSHOT('outgoing one-line message bubble'), async () => {
    await verifyElementScreenshot(
      alice1,
      new MessageBodyScreenshot(alice1, shortMessage),
      testInfo,
      'outgoing_short_message'
    );
  });
  await test.step(TestSteps.VERIFY.SCREENSHOT('incoming one-line message bubble'), async () => {
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, shortMessage));
    await verifyElementScreenshot(
      bob1,
      new MessageBodyScreenshot(bob1, shortMessage),
      testInfo,
      'incoming_short_message'
    );
  });
  await test.step(TestSteps.SEND.REPLY(bob.userName, alice.userName), async () => {
    // Bob replies with a longer message
    await bob1.longPressMessage(shortMessage);
    await bob1.clickOnByAccessibilityID('Reply to message');
    await bob1.inputText(replyMessage, new MessageInput(bob1));
    await bob1.clickOnElementAll(new SendButton(bob1));
    await bob1.waitForTextElementToBePresent({
      ...new OutgoingMessageStatusSent(bob1).build(),
      maxWait: 20_000,
    });
  });
  await test.step(
    TestSteps.VERIFY.SCREENSHOT('outgoing multiline reply message bubble'),
    async () => {
      await bob1.waitForTextElementToBePresent(new MessageBody(bob1, replyMessage)); // Otherwise there were stale element errors
      await verifyElementScreenshot(
        bob1,
        new MessageBodyScreenshot(bob1, replyMessage),
        testInfo,
        'outgoing_reply_message'
      );
    }
  );
  await test.step(
    TestSteps.VERIFY.SCREENSHOT('incoming multiline reply message bubble'),
    async () => {
      await alice1.waitForTextElementToBePresent(new MessageBody(alice1, replyMessage));
      await verifyElementScreenshot(
        alice1,
        new MessageBodyScreenshot(alice1, replyMessage),
        testInfo,
        'incoming_reply_message'
      );
    }
  );
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
