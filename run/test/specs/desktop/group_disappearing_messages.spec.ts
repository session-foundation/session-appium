// Rewritten to drive the app through DesktopWrapper instead of raw Playwright Pages.

import {
  defaultDisappearingOptions,
  longText,
  mediaArray,
  testLink,
  testLinkTitle,
} from '../../../desktop/constants/variables';
import { Conversation } from '../../../desktop/locators';
import { test_group_Alice_1W_Bob_1W_Charlie_1W } from '../../../desktop/sessionTest';
import { hasElementBeenDeleted, hasTextMessageBeenDeleted } from '../../../desktop/utils';
import { sleepFor } from '../../../shared/promise_utils';

// Disappearing time settings for all tests
const { timeOption, disappearingMessagesType, disappearAction } = defaultDisappearingOptions.group;

mediaArray.forEach(({ mediaType, path, shouldCheckMediaPreview }) => {
  test_group_Alice_1W_Bob_1W_Charlie_1W(
    `Send disappearing ${mediaType} groups`,
    async ({ alice, bob, charlie, groupCreated }) => {
      const testMessage = `${alice.userName} sending ${mediaType} to ${groupCreated.userName}`;
      await alice.setDisappearingMessages([
        'group',
        disappearingMessagesType,
        timeOption,
        disappearAction,
      ]);
      // Send media
      if (mediaType === 'voice') {
        await alice.sendVoiceMessage();
      } else {
        await alice.sendMedia(path, testMessage, shouldCheckMediaPreview);
      }
      if (mediaType === 'voice') {
        await Promise.all([
          bob.waitForLoadingAnimationToFinish('loading-animation'),
          charlie.waitForLoadingAnimationToFinish('loading-animation'),
          bob.waitForTestIdWithText('audio-player'),
          charlie.waitForTestIdWithText('audio-player'),
        ]);
        await sleepFor(10000);
        await Promise.all(
          [bob, charlie].map(w =>
            hasElementBeenDeleted(w.getPage(), Conversation.audioPlayer, {
              maxWait: 1_000,
            })
          )
        );
      } else {
        await Promise.all([
          bob.waitForLoadingAnimationToFinish('loading-animation'),
          charlie.waitForLoadingAnimationToFinish('loading-animation'),
          bob.waitForTextMessage(testMessage),
          charlie.waitForTextMessage(testMessage),
        ]);
        // Wait 10 seconds for image to disappear
        await sleepFor(10000);
        await Promise.all([
          hasTextMessageBeenDeleted(bob.getPage(), testMessage),
          hasTextMessageBeenDeleted(charlie.getPage(), testMessage),
        ]);
      }
    }
  );
});

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Send disappearing long text to groups',
  async ({ alice, bob, charlie }) => {
    await alice.setDisappearingMessages([
      'group',
      disappearingMessagesType,
      timeOption,
      disappearAction,
    ]);
    await alice.sendMessage(longText);
    await Promise.all([bob.waitForTextMessage(longText), charlie.waitForTextMessage(longText)]);
    await sleepFor(30000);
    await Promise.all([
      hasTextMessageBeenDeleted(bob.getPage(), longText),
      hasTextMessageBeenDeleted(charlie.getPage(), longText),
    ]);
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Send disappearing link preview to groups',
  async ({ alice, bob, charlie }) => {
    await alice.setDisappearingMessages([
      'group',
      disappearingMessagesType,
      timeOption,
      disappearAction,
    ]);
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

    await sleepFor(30000);
    await Promise.all(
      [bob, charlie].map(w =>
        hasElementBeenDeleted(w.getPage(), Conversation.linkPreviewTitle, {
          maxWait: 1_000,
          text: testLinkTitle,
        })
      )
    );
  }
);
