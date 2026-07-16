// Copied from session-playwright (tests/automation/utilities/conversation.ts).
// Only import paths were rewritten to `./` siblings.

import type { Page } from '@playwright/test';

import { Conversation, HomeScreen } from './locators';
import { sleepFor } from './promise_utils';
import { clickOnWithText, scrollToBottomIfNecessary, waitForTestIdWithText } from './utils';

/**
 * Open a conversation from the left pane with the provided name
 */
export async function openConversationWith(window: Page, convoName: string) {
  await clickOnWithText(window, HomeScreen.conversationItemName, convoName);
}

export async function scrollToBottomLookingForMessage({
  window,
  msg,
}: {
  window: Page;
  msg: string;
}) {
  // It seems that for communities, we sometimes need to press multiple times the scroll to bottom
  // button for the message to be visible.
  const start = Date.now();
  do {
    try {
      await window.bringToFront();

      await scrollToBottomIfNecessary(window);
      const found = await waitForTestIdWithText(
        window,
        Conversation.messageContent.selector,
        msg,
        100
      );
      if (found) {
        console.info(`scrollToBottomLookingForMessage: Found message "${msg}"`);
        break;
      }
    } catch (_e) {
      // nothing to do here
    }
    await sleepFor(1000, true);
  } while (Date.now() - start < 15_000);

  // this just checks if the message is visible or not after exiting the loop. i.e. this will throw if the message is not visible
  await waitForTestIdWithText(window, Conversation.messageContent.selector, msg, 100);
}
