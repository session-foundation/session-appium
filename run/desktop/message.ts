// @ported-from tests/automation/utilities/message.ts
// @port-kind   verbatim
import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { Global } from './locators';
import { sleepFor } from './promise_utils';
import { MessageStatus } from './types';
import {
  buildSelectorEscapeText,
  checkModalStrings,
  clickOn,
  clickOnElement,
  clickOnMatchingText,
  clickOnTextMessage,
  hasTextMessageBeenDeleted,
  pasteIntoInput,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';

export type MessageDeleteType = 'device_only' | 'for_all_my_devices' | 'for_everyone';

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

export async function deleteMessageFor(
  window: Page,
  message: string,
  deletionType: MessageDeleteType
) {
  await clickOnTextMessage(window, message, true);
  await clickOnMatchingText(window, tStripped('delete'));
  switch (deletionType) {
    case 'device_only':
      await clickOnMatchingText(window, tStripped('deleteMessageDeviceOnly'));
      break;
    case 'for_everyone':
      await clickOnMatchingText(window, tStripped('deleteMessageEveryone'));
      break;
    case 'for_all_my_devices':
      await clickOnMatchingText(window, tStripped('deleteMessageDevicesAll'));
      break;
  }

  await checkModalStrings(
    window,
    tStripped('deleteMessage', { count: 1 }),
    tStripped('deleteMessageConfirm', { count: 1 })
  );

  await clickOn(window, Global.confirmButton);

  await waitForTestIdWithText(
    window,
    'session-toast',
    tStripped('deleteMessageDeleted', { count: 1 })
  );
}

/**
 * Wait 15s and then confirms that all of the windows have the message
 * in the expected state, depending on the delete type.
 */
export async function confirmMessageDeletedFor({
  deleteType,
  messageToDelete,
  otherWindows,
  windowInitiatingDelete,
}: {
  windowInitiatingDelete: Page;
  otherWindows: Array<Page>;
  messageToDelete: string;
  deleteType: MessageDeleteType;
}) {
  // explicit wait to make sure a deleted locally that was wrongly deleted globally had time to propagate
  await sleepFor(15_000, true);
  switch (deleteType) {
    case 'device_only':
      await Promise.all([
        // the content of the original message should be removed on the device that removed it
        hasTextMessageBeenDeleted(windowInitiatingDelete, messageToDelete, 1_000),
        // and should have been replaced with a tombstone (local version)
        waitForMatchingText(
          windowInitiatingDelete,
          tStripped('deleteMessageDeletedLocally'),
          1_000
        ),

        // the other devices should have the message still visible
        ...otherWindows.map(w => waitForMatchingText(w, messageToDelete, 1_000)),
      ]);
      break;
    case 'for_everyone':
      await Promise.all([
        // all of the devices should have the message content removed
        ...[windowInitiatingDelete, ...otherWindows].map(w =>
          hasTextMessageBeenDeleted(w, messageToDelete, 1_000)
        ),
        // all of the devices should have the tombstone shown (global version)
        ...[windowInitiatingDelete, ...otherWindows].map(w =>
          waitForMatchingText(w, tStripped('deleteMessageDeletedGlobally'), 1_000)
        ),
      ]);
      break;
    case 'for_all_my_devices':
      // NTS for_all_my_devices does not leave tombstones, it removes the messages completely from all clients
      await Promise.all([
        // all of our devices should have the message removed
        ...[windowInitiatingDelete, ...otherWindows].map(w =>
          hasTextMessageBeenDeleted(w, messageToDelete, 1_000)
        ),
        // and no tombstones at all
        ...[windowInitiatingDelete, ...otherWindows].map(w =>
          hasTextMessageBeenDeleted(w, tStripped('deleteMessageDeletedGlobally'), 1_000)
        ),
      ]);
      break;

    default:
      break;
  }
}
