// Trimmed copy of session-playwright's tests/automation/utilities/message.ts —
// only the message-sending helpers the DesktopWrapper needs. The delete-message
// helpers were intentionally left out.
import { Page } from '@playwright/test';

import { MessageStatus } from './types';
import { buildSelectorEscapeText, clickOnElement, pasteIntoInput } from './utils';

export const waitForMessageStatus = async (
  window: Page,
  message: string,
  status: MessageStatus
) => {
  const selector =
    buildSelectorEscapeText(
      {
        strategy: 'data-testid',
        selector: 'message-container',
      } as const,
      message
    ) + `:has([data-testid=msg-status][data-testtype=${status}])`;
  const logSig = `${status} status of message '${message}'`;

  const messageStatus = await window.waitForSelector(selector, {
    timeout: 20_000, // a gif on mainnet can take a long time to upload
  });
  console.info(`${logSig} is ${!!messageStatus}`);
};

export const sendMessage = async (window: Page, message: string) => {
  // type into message input box
  await pasteIntoInput(window, 'message-input-text-area', message);
  // click up arrow (send)
  await clickOnElement({
    window,
    strategy: 'data-testid',
    selector: 'send-message-button',
  });
  await waitForMessageStatus(window, message, 'sent');
};
