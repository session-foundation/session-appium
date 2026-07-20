// @ported-from tests/automation/disappearing_message_checks.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { testCommunityName } from '../../../desktop/constants/community';
import {
  defaultDisappearingOptions,
  longText,
  mediaArray,
  testLink,
  testLinkTitle,
} from '../../../desktop/constants/variables';
import { Conversation, ConversationSettings, Global } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';
import {
  formatTimeOption,
  hasElementBeenDeleted,
  hasTextMessageBeenDeleted,
} from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

// Disappearing time settings for all tests
const { timeOption, disappearingMessagesType, disappearAction } = defaultDisappearingOptions.DAS;

mediaArray.forEach(({ mediaType, path, attachmentType, shouldCheckMediaPreview }) => {
  test_Alice_1W_Bob_1W(`Send disappearing ${mediaType} 1:1`, async ({ alice, bob }) => {
    const testMessage = `${alice.userName} sending disappearing ${mediaType} to ${bob.userName}`;
    const formattedTime = formatTimeOption(timeOption);
    await alice.createContactWith(bob);
    // Set disappearing messages
    await alice.setDisappearingMessages(
      ['1:1', disappearingMessagesType, timeOption, disappearAction],
      bob
    );
    await Promise.all([
      alice.waitForTestIdWithText(
        Conversation.disappearingControlMessage.selector,
        tStripped('disappearingMessagesSetYou', {
          time: formattedTime,
          disappearing_messages_type: disappearAction,
        })
      ),
      bob.waitForTestIdWithText(
        Conversation.disappearingControlMessage.selector,
        tStripped('disappearingMessagesSet', {
          time: formattedTime,
          disappearing_messages_type: disappearAction,
          name: alice.userName,
        })
      ),
    ]);
    // Send media
    if (mediaType === 'voice') {
      await alice.sendVoiceMessage();
    } else {
      await alice.sendMedia(path, testMessage, shouldCheckMediaPreview);
    }
    // Click on untrusted attachment
    await bob.trustUser(attachmentType, alice.userName);

    await bob.waitForLoadingAnimationToFinish('loading-animation');
    if (mediaType === 'voice') {
      await bob.waitForTestIdWithText('audio-player');
      await sleepFor(30000);
      await hasElementBeenDeleted(bob.getPage(), Conversation.audioPlayer, {
        maxWait: 1_000,
      });
    } else {
      await bob.waitForTextMessage(testMessage);
      // Wait 30 seconds for image to disappear
      await sleepFor(30000);
      await hasTextMessageBeenDeleted(bob.getPage(), testMessage);
    }
  });
});

test_Alice_1W_Bob_1W(`Send disappearing long text 1:1`, async ({ alice, bob }) => {
  const formattedTime = formatTimeOption(timeOption);
  await alice.createContactWith(bob);
  // Set disappearing messages
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  await Promise.all([
    alice.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSetYou', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
      })
    ),
    bob.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSet', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
        name: alice.userName,
      })
    ),
  ]);
  await alice.pasteIntoInput('message-input-text-area', longText);
  await sleepFor(100);
  await alice.clickOn(Conversation.sendMessageButton);
  await alice.waitForMessageStatus(longText, 'sent');
  await bob.waitForTextMessage(longText);
  // Wait 30 seconds for long text to disappear
  await sleepFor(30000);
  await hasTextMessageBeenDeleted(bob.getPage(), longText);
});

test_Alice_1W_Bob_1W(`Send disappearing link preview 1:1`, async ({ alice, bob }) => {
  const formattedTime = formatTimeOption(timeOption);
  await alice.createContactWith(bob);
  // Set disappearing messages
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  await Promise.all([
    alice.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSetYou', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
      })
    ),
    bob.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSet', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
        name: alice.userName,
      })
    ),
  ]);
  await alice.sendLinkPreview(testLink);
  await bob.waitForElement({
    locator: Conversation.linkPreviewTitle,
    options: {
      maxWaitMs: 10_000,
      shouldLog: true,
      text: testLinkTitle,
    },
  });
  // Wait 30 seconds for link preview to disappear
  await sleepFor(30_000);
  await hasElementBeenDeleted(bob.getPage(), Conversation.linkPreviewTitle, {
    maxWait: 1_000, // no need to wait too long here, it should have disappeared already
    text: testLinkTitle,
  });
});

test_Alice_1W_Bob_1W(`Send disappearing community invite 1:1`, async ({ alice, bob }) => {
  const formattedTime = formatTimeOption(timeOption);
  await alice.createContactWith(bob);
  // Set disappearing messages
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  await Promise.all([
    alice.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSetYou', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
      })
    ),
    bob.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSet', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
        name: alice.userName,
      })
    ),
  ]);
  await alice.joinCommunity();
  // To stop the layout shift
  await sleepFor(500);
  await alice.clickOn(Conversation.conversationSettingsIcon);
  await alice.clickOn(ConversationSettings.inviteContactsOption);
  await alice.waitForTestIdWithText('modal-heading', tStripped('membersInvite'));
  await alice.clickOnWithText(Global.contactItem, bob.userName);
  await alice.clickOn(Global.confirmButton);
  // For lack of a unique ID we use native Playwright methods
  await alice
    .getPage()
    .getByTestId('invite-contacts-dialog')
    .getByTestId('modal-close-button')
    .click();
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
  // Wait 30 seconds for community invite to disappear
  await sleepFor(30000);
  await Promise.all(
    [bob, alice].map(w =>
      hasElementBeenDeleted(w.getPage(), Conversation.communityInvitationDetails, {
        maxWait: 1_000,
        text: testCommunityName,
      })
    )
  );
});

test_Alice_1W_Bob_1W(`Send disappearing call message 1:1`, async ({ alice, bob }) => {
  const formattedTime = formatTimeOption(timeOption);
  await alice.createContactWith(bob);
  // Set disappearing messages
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  await Promise.all([
    alice.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSetYou', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
      })
    ),
    bob.waitForTestIdWithText(
      Conversation.disappearingControlMessage.selector,
      tStripped('disappearingMessagesSet', {
        time: formattedTime,
        disappearing_messages_type: disappearAction,
        name: alice.userName,
      })
    ),
  ]);
  await alice.makeVoiceCallTo(bob);
  // In the receivers window, the message is 'Call in progress'
  await Promise.all([
    bob.waitForElement({
      locator: Conversation.callNotificationAnswered,
      options: {
        text: tStripped('callsInProgress'),
        shouldLog: true,
        maxWaitMs: 15_000,
      },
    }),
    // In the callers window, the message is 'You called {receiverName}'
    alice.waitForTestIdWithText(
      'call-notification-started-call',
      tStripped('callsYouCalled', { name: bob.userName })
    ),
  ]);
  // Wait 30 seconds for call message to disappear
  await sleepFor(30000);

  await Promise.all([
    hasElementBeenDeleted(bob.getPage(), Conversation.callNotificationAnswered, {
      maxWait: 1_000,
      text: tStripped('callsInProgress'),
    }),
    hasElementBeenDeleted(alice.getPage(), Conversation.callNotificationStarted, {
      maxWait: 1_000,
      text: tStripped('callsYouCalled', { name: bob.userName }),
    }),
  ]);
});
