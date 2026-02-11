import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage, MessageBody } from './locators/conversation';
import { ConversationItem, MessageSnippet } from './locators/home';
import { open_Alice2_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsent message syncs',
  risk: 'medium',
  testCb: unSendMessageLinkedDevice,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Message',
  },
  allureDescription: `Verifies that 'Delete for everyone' in a 1-1 deletes the message in the conversation view and on the home screen for both parties and a linked device.`,
});

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // we send two messages to make sure deletion works OK
  const firstMessage = 'Hello';
  const secondMessage = 'Howdy';

  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { alice, bob },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });
  });

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, bob.userName), async () => {
    await alice1.sendMessage(firstMessage);
    await alice1.sendMessage(secondMessage);
  });

  // Check message came through on alice2 and bob1
  await test.step(TestSteps.VERIFY.MESSAGE_RECEIVED, async () => {
    await alice2.clickOnElementAll(new ConversationItem(alice2, bob.userName));
    // Find message
    await Promise.all(
      [bob1, alice2].map(async device => {
        await device.findMessageWithBody(firstMessage);
        await device.findMessageWithBody(secondMessage);
      })
    );
  });

  // alice1 deletes message for everyone
  await test.step(TestSteps.USER_ACTIONS.DELETE_FOR_EVERYONE, async () => {
    await alice1.longPressMessage(new MessageBody(alice1, secondMessage));
    await alice1.clickOnByAccessibilityID('Delete message');
    await test.step(TestSteps.VERIFY.SPECIFIC_MODAL('Delete message'), async () => {
      await alice1.checkModalStrings(
        tStripped('deleteMessage', { count: 1 }),
        tStripped('deleteMessageConfirm', { count: 1 })
      );
    });
    await alice1.clickOnElementAll(new DeleteMessageForEveryone(alice1));
    await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  });

  // check the first message is still there, the second message deleted and replaced with deleted message
  await test.step(TestSteps.VERIFY.MESSAGE_DELETED('conversation view'), async () => {
    await Promise.all(
      [alice1, bob1, alice2].map(async device => {
        await device.waitForTextElementToBePresent(new MessageBody(device, firstMessage));
        await device.verifyElementNotPresent(new MessageBody(device, secondMessage));
        await device.waitForTextElementToBePresent({
          ...new DeletedMessage(device).build(),
          maxWait: 10_000,
        });
        await device.back();
      })
    );
  });

  // check home screen snippet now shows first message again
  await test.step(TestSteps.VERIFY.MESSAGE_DELETED('home screen'), async () => {
    await Promise.all(
      [alice1, alice2].map(device =>
        device.waitForTextElementToBePresent({
          ...new MessageSnippet(device, bob.userName, firstMessage).build(),
          maxWait: 5_000,
        })
      )
    );
    await bob1.waitForTextElementToBePresent({
      ...new MessageSnippet(bob1, alice.userName, firstMessage).build(),
      maxWait: 5_000,
    });
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, alice2);
  });
}
