// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { testCommunityName } from '../../../desktop/constants/community';
import {
  longText,
  mediaArray,
  testLink,
  testLinkTitle,
} from '../../../desktop/constants/variables';
import {
  Conversation,
  ConversationSettings,
  CTA,
  Global,
  HomeScreen,
} from '../../../desktop/locators';
import {
  sessionTestTwoWindows,
  test_Alice_1W,
  test_Alice_1W_Bob_1W,
  test_Alice_2W,
  test_Alice_2W_Bob_1W,
} from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';
import { sleepFor } from '../../../shared/promise_utils';

mediaArray.forEach(({ mediaType, path, attachmentType, shouldCheckMediaPreview }) => {
  test_Alice_1W_Bob_1W(`Send ${mediaType} 1:1`, async ({ alice, bob }) => {
    const testMessage = `${alice.userName} sending ${mediaType} to ${bob.userName}`;
    const testReply = `${bob.userName} replying to ${mediaType} from ${alice.userName}`;
    await alice.createContactWith(bob);
    if (mediaType === 'voice') {
      await alice.sendVoiceMessage();
    } else {
      await alice.sendMedia(path, testMessage, shouldCheckMediaPreview);
    }
    // Click on untrusted attachment in window B
    await sleepFor(1000);
    await bob.trustUser(attachmentType, alice.userName);
    await bob.waitForLoadingAnimationToFinish('loading-animation');
    // Waiting for image to change from loading state to loaded (takes a second)
    await sleepFor(1000);
    if (mediaType === 'voice') {
      await bob.replyToMedia({
        locator: Conversation.audioPlayer,
        replyText: testReply,
        to: alice,
      });
    } else {
      await bob.replyTo({
        textMessage: testMessage,
        replyText: testReply,
        to: alice,
        shouldCheckMediaPreview,
      });
    }
  });
});

test_Alice_1W_Bob_1W('Send long text 1:1', async ({ alice, bob }) => {
  const testReply = `${bob.userName} replying to long text message from ${alice.userName}`;
  await alice.createContactWith(bob);
  await alice.pasteIntoInput('message-input-text-area', longText);
  await sleepFor(100);
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: 'send-message-button',
  });
  // await waitForSentTick(aliceWindow1, longText);
  await sleepFor(1000);
  await bob.replyTo({
    textMessage: longText,
    replyText: testReply,
    to: alice,
  });
});

test_Alice_1W_Bob_1W('Send link preview 1:1', async ({ alice, bob }) => {
  const testReply = `${bob.userName} replying to link from ${alice.userName}`;

  await alice.createContactWith(bob);
  await alice.sendLinkPreview(testLink);
  await bob.waitForElement({
    locator: Conversation.linkPreviewTitle,
    options: {
      maxWaitMs: 3_000,
      shouldLog: true,
      text: testLinkTitle,
    },
  });
  await bob.replyTo({
    textMessage: testLink,
    replyText: testReply,
    to: alice,
  });
});

test_Alice_1W_Bob_1W('Send community invite', async ({ alice, bob }) => {
  await alice.createContactWith(bob);
  await alice.joinCommunity();
  await alice.clickOn(Conversation.conversationSettingsIcon);
  await alice.clickOn(ConversationSettings.inviteContactsOption);
  await alice.waitForTestIdWithText('modal-heading', tStripped('membersInvite'));
  await alice.clickOnWithText(Global.contactItem, bob.userName);
  await alice.clickOn(Global.confirmButton);
  // For lack of a unique ID we use native Playwright methods
  await alice
    .getPage()
    .getByTestId('invite-contacts-dialog')
    .getByTestId(Global.modalCloseButton.selector)
    .click();
  // Close UCS modal
  await alice.clickOn(Global.modalCloseButton);
  await alice.openConversationWith(bob.userName);
  await Promise.all(
    [alice, bob].map(w =>
      w.waitForElement({
        locator: Conversation.communityInvitationDetails,
        options: {
          maxWaitMs: 15_000,
          shouldLog: true,
          text: testCommunityName,
        },
      })
    )
  );
});

const delete1o1TypeArray = [
  'device_only_outgoing',
  'device_only_incoming',
  'for_everyone',
] as const;

delete1o1TypeArray.forEach(deleteType => {
  test_Alice_2W_Bob_1W(`Delete message 1:1 ${deleteType}`, async ({ alice, alice2, bob }) => {
    const messageToDelete = `Testing deletion functionality for ${deleteType}`;
    await alice.createContactWith(bob);
    await alice.sendMessage(messageToDelete);
    // Navigate to conversation on linked device and for message from user A to user B
    await alice2.openConversationWith(bob.userName);

    await Promise.all([
      alice2.waitForTextMessage(messageToDelete, 15_000),
      bob.waitForTextMessage(messageToDelete, 15_000),
    ]);

    // Alice sent the message, device_only_incoming means getting Bob to delete Alice's message locally.
    // Otherwise, it's an action that Alice does on her own message.

    const windowInitiatingDelete = deleteType === 'device_only_incoming' ? bob : alice;
    const otherWindows = [alice, alice2, bob].filter(w => w !== windowInitiatingDelete);

    const simplifiedDeleteType =
      deleteType === 'device_only_incoming' || deleteType === 'device_only_outgoing'
        ? 'device_only'
        : 'for_everyone';

    await windowInitiatingDelete.deleteMessageFor(messageToDelete, simplifiedDeleteType);

    await windowInitiatingDelete.confirmMessageDeletedFor({
      deleteType: simplifiedDeleteType,
      messageToDelete,
      otherWindows,
    });
  });
});

const deleteNtsTypeArray = ['device_only', 'for_all_my_devices'] as const;

deleteNtsTypeArray.forEach(deleteType => {
  test_Alice_2W(`Delete message NTS ${deleteType}`, async ({ alice, alice2 }) => {
    const messageToDelete = `Testing deletion functionality for NTS ${deleteType}`;
    await alice.sendNewMessage(alice.accountId, messageToDelete);
    // Navigate to conversation on linked device
    await alice2.openConversationWith(tStripped('noteToSelf'));
    await Promise.all([
      alice.waitForTextMessage(messageToDelete, 15_000),
      alice2.waitForTextMessage(messageToDelete, 15_000),
    ]);

    await alice.deleteMessageFor(messageToDelete, deleteType);

    await alice.confirmMessageDeletedFor({
      deleteType,
      messageToDelete,
      otherWindows: [alice2],
    });
  });
});

sessionTestTwoWindows('Check performance', async ([alice, bob]) => {
  await Promise.all([alice.onboard('Alice'), bob.onboard('Bob')]);
  // Create contact
  await alice.createContactWith(bob);
  const timesArray: Array<number> = [];

  let i;
  for (i = 1; i <= 10; i++) {
    const timeMs = await alice.measureSendingTime(i);
    timesArray.push(timeMs);
  }
  console.log(timesArray);
});

// Message length limit tests (pre-pro)
const maxChars = 2000;
const countdownThreshold = 1800;

const messageLengthTestCases = [
  {
    length: 1799,
    char: 'a',
    shouldSend: true,
  },
  {
    length: 1800,
    char: 'b',
    shouldSend: true,
  },
  {
    length: 2000,
    char: 'c',
    shouldSend: true,
  },
  {
    length: 2001,
    char: 'd',
    shouldSend: false,
  },
];

messageLengthTestCases.forEach(testCase => {
  test_Alice_1W_Bob_1W(
    `Message length limit (${testCase.length} chars)`,
    async ({ alice, bob }) => {
      await alice.createContactWith(bob);
      const expectedCount =
        testCase.length < countdownThreshold ? null : (maxChars - testCase.length).toString();
      const message = testCase.char.repeat(testCase.length);
      // Type the message
      await alice.pasteIntoInput('message-input-text-area', message);

      // Check countdown behavior
      if (expectedCount) {
        await alice.waitForElement({
          locator: Conversation.tooltipCharacterCount,
          options: { text: expectedCount },
        });
      } else {
        // Verify countdown tooltip is not present: waitForElement should TIME OUT (throw).
        // If it resolves, the countdown was wrongly visible, so fail — outside the catch, so
        // the failure isn't swallowed by the handler that absorbs the expected timeout.
        let countdownVisible = false;
        try {
          await alice.waitForElement({
            locator: Conversation.tooltipCharacterCount,
            options: {
              maxWaitMs: 1_000,
              shouldLog: true,
            },
          });
          countdownVisible = true;
        } catch (_e) {
          // Expected - countdown should not exist
        }
        if (countdownVisible) {
          throw new Error(
            `Countdown should not be visible for messages under ${countdownThreshold} chars`
          );
        }
        console.log('Countdown not present as expected');
      }

      // Try to send
      await alice.clickOn(Conversation.sendMessageButton);

      if (testCase.shouldSend) {
        // Message should appear in Alice's window
        await Promise.all(
          [alice, bob].map(async w => {
            await w.waitForTextMessage(message);
          })
        );
      } else {
        if (process.env.SESSION_PRO) {
          console.log('Session Pro detected, checking CTA');
          // Upgrade to pro
          await alice.checkCTAStrings(
            tStripped('upgradeTo'),
            tStripped('proCallToActionLongerMessages'),
            [tStripped('theContinue'), tStripped('cancel')],
            [
              ` ${tStripped('proFeatureListLongerMessages')}`,
              ` ${tStripped('proFeatureListPinnedConversations')}`,
              tStripped('proFeatureListLoadsMore'),
            ]
          );
          await alice.clickOn(CTA.cancelButton);
        } else {
          console.log('Session Pro not detected, checking modal');
          // Message Too Long modal
          await alice.checkModalStrings(
            tStripped('modalMessageTooLongTitle'),
            tStripped('modalMessageTooLongDescription', {
              limit: maxChars.toLocaleString('en-AU'),
            }) // Force "2,000" instead of "2000"
          );
          await alice.clickOn(Global.confirmButton);
        }

        // Verify message didn't send: waitForTextMessage should TIME OUT (throw). If it
        // resolves, the message was unexpectedly sent, so fail — outside the catch, so the
        // failure isn't swallowed by the same handler that absorbs the expected timeout.
        let wasSent = false;
        try {
          await alice.waitForTextMessage(message, 2000);
          wasSent = true;
        } catch (_e) {
          // expected: the message never appeared, so waitForTextMessage timed out
        }
        if (wasSent) {
          throw new Error('Message should not have been sent');
        }
        console.log(`Message didn't send as expected`);
      }
    }
  );
});

test_Alice_1W('Emoji does not show for links', async ({ alice }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.pasteIntoInput(HomeScreen.newMessageAccountIDInput.selector, alice.accountId);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  await alice.pasteIntoInput(Conversation.messageInput.selector, ':a');
  await alice.waitForTestIdWithText(Conversation.mentionsContainer.selector);
  await alice.waitForTestIdWithText(Conversation.mentionsItem.selector, ':a:');
  await alice.pasteIntoInput(Conversation.messageInput.selector, 'https:/');
  await alice.hasElementPoppedUpThatShouldnt(Conversation.mentionsContainer);
  await alice.pasteIntoInput(Conversation.messageInput.selector, 'check this out https:/');
  await alice.hasElementPoppedUpThatShouldnt(Conversation.mentionsContainer);
});

test_Alice_1W('Emoji closes when clicking away', async ({ alice }) => {
  await alice.clickOn(HomeScreen.plusButton);
  await alice.clickOn(HomeScreen.newMessageOption);
  await alice.pasteIntoInput(HomeScreen.newMessageAccountIDInput.selector, alice.accountId);
  await alice.clickOn(HomeScreen.newMessageNextButton);
  await alice.pasteIntoInput(Conversation.messageInput.selector, 'hey check this out :a');
  await alice.waitForTestIdWithText(Conversation.mentionsContainer.selector);
  await alice.waitForTestIdWithText(Conversation.mentionsItem.selector, ':a:');
  await alice.clickOn(Conversation.messageInput);
  await alice.hasElementPoppedUpThatShouldnt(Conversation.mentionsContainer);
});
