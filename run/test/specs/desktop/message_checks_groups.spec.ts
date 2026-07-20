// @ported-from tests/automation/message_checks_groups.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of raw Playwright Pages.

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import {
  longText,
  mediaArray,
  testLink,
  testLinkTitle,
} from '../../../desktop/constants/variables';
import { Conversation } from '../../../desktop/locators';
import { type MessageDeleteType } from '../../../desktop/message';
import { sleepFor } from '../../../desktop/promise_utils';
import {
  test_group_Alice_1W_Bob_1W_Charlie_1W,
  test_group_Alice_2W_Bob_1W_Charlie_1W,
} from '../../../desktop/sessionTest';
import { assertUnreachable } from '../../../desktop/utils';

mediaArray.forEach(({ mediaType, path, shouldCheckMediaPreview }) => {
  test_group_Alice_1W_Bob_1W_Charlie_1W(
    `Send ${mediaType} to group`,
    async ({ alice, bob, charlie, groupCreated }) => {
      const testMessage = `${alice.userName} sending ${mediaType} to ${groupCreated.userName}`;
      const testReply = `${bob.userName} replying to ${mediaType} from ${alice.userName} in ${groupCreated.userName}`;
      // Send media
      if (mediaType === 'voice') {
        await alice.sendVoiceMessage();
      } else {
        await alice.sendMedia(path, testMessage, shouldCheckMediaPreview);
      }
      if (mediaType === 'document' || mediaType === 'voice') {
        console.log('No loading animation for documents and voice message');
      } else {
        await Promise.all([
          bob.waitForLoadingAnimationToFinish('loading-animation'),
          charlie.waitForLoadingAnimationToFinish('loading-animation'),
        ]);
      }
      if (mediaType === 'voice') {
        await Promise.all([
          bob.waitForTestIdWithText('audio-player'),
          charlie.waitForTestIdWithText('audio-player'),
        ]);
      } else {
        await Promise.all([
          bob.waitForTextMessage(testMessage),
          charlie.waitForTextMessage(testMessage),
        ]);
      }
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

      // reply was sent from bobWindow1 and awaited from aliceWindow1 already
      await charlie.waitForTextMessage(testReply);
    }
  );
});

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Send long text to group',
  async ({ alice, bob, charlie, groupCreated }) => {
    const testReply = `${bob.userName} replying to long text message from ${alice.userName} in ${groupCreated.userName}`;
    await alice.pasteIntoInput('message-input-text-area', longText);
    await sleepFor(100);
    await alice.clickOnElement({
      strategy: 'data-testid',
      selector: 'send-message-button',
    });
    await sleepFor(1000);
    await bob.replyTo({
      textMessage: longText,
      replyText: testReply,
      to: charlie,
    });
    await charlie.waitForTextMessage(longText);
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Send link preview to group',
  async ({ alice, bob, charlie, groupCreated }) => {
    const testReply = `${bob.userName} replying to link from ${alice.userName} in ${groupCreated.userName}`;
    await alice.sendLinkPreview(testLink);
    await Promise.all(
      [bob, charlie].map(w =>
        w.waitForElement({
          locator: Conversation.linkPreviewTitle,
          options: {
            maxWaitMs: 3_000,
            shouldLog: true,
            text: testLinkTitle,
          },
        })
      )
    );

    await bob.replyTo({
      textMessage: testLink,
      replyText: testReply,
      to: alice,
    });
  }
);

const deleteGroupTypeArray = [
  'device_only_outgoing',
  'device_only_incoming',
  // as normal user, delete one of our own messages
  'for_everyone',
  // as an admin, delete someone else message
  'as_admin_for_everyone',
] as const;

deleteGroupTypeArray.forEach(deleteType =>
  test_group_Alice_2W_Bob_1W_Charlie_1W(
    `Delete message in group ${deleteType}`,
    async ({ alice, alice2, bob, charlie, groupCreated }) => {
      // Note: Alice is the admin in this group, Bob is a member without admin rights
      const unsendMessageFromBob = `Testing delete ${deleteType} in group from ${bob.userName}`;
      // focus the conversation on aliceWindow2 (not done as restored from seed)
      await alice2.openConversationWith(groupCreated.userName);

      await bob.sendMessage(unsendMessageFromBob);
      await Promise.all(
        [alice, alice2, bob, charlie].map(w => w.waitForTextMessage(unsendMessageFromBob, 15_000))
      );

      let windowInitiatingDelete: DesktopWrapper | undefined;
      let fallbackDeleteType: MessageDeleteType | undefined;
      switch (deleteType) {
        case 'device_only_incoming':
          // make Charlie delete Bob's message locally
          windowInitiatingDelete = charlie;
          fallbackDeleteType = 'device_only';

          break;
        case 'device_only_outgoing':
        case 'for_everyone':
          // Bob sent this message, so should be able to delete it both locally and for everyone
          windowInitiatingDelete = bob;
          fallbackDeleteType = deleteType === 'for_everyone' ? 'for_everyone' : 'device_only';
          break;
        case 'as_admin_for_everyone':
          // Alice (admin) is deleting Bob's message
          windowInitiatingDelete = alice;
          fallbackDeleteType = 'for_everyone';
          break;
        default:
          assertUnreachable(deleteType, `assertUnreachable for deleteType`);
          break;
      }
      const otherWindows = [alice, alice2, bob, charlie].filter(m => m !== windowInitiatingDelete);

      // Bob sent this message, so should be able to delete it locally or for everyone
      await windowInitiatingDelete.deleteMessageFor(unsendMessageFromBob, fallbackDeleteType);
      await windowInitiatingDelete.confirmMessageDeletedFor({
        deleteType: fallbackDeleteType,
        messageToDelete: unsendMessageFromBob,
        otherWindows,
      });
    }
  )
);
