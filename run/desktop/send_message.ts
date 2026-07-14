// Copied from session-playwright (tests/automation/utilities/send_message.ts).
// Import paths rewritten for run/desktop/.
import { Page } from '@playwright/test';

import { HomeScreen } from './locators';
import { sendMessage } from './message';
import { clickOn, pasteIntoInput } from './utils';

export const sendNewMessage = async (window: Page, sessionId: string, message: string) => {
  await clickOn(window, HomeScreen.plusButton);
  await clickOn(window, HomeScreen.newMessageOption);
  // Enter session ID of USER B
  await pasteIntoInput(window, 'new-session-conversation', sessionId);
  // click next
  await clickOn(window, HomeScreen.newMessageNextButton);
  await sendMessage(window, message);
};
