import { Page } from '@playwright/test';

import type { DesktopWrapper } from './DesktopWrapper';

import { tStripped } from '../localizer/lib';
import { MESSAGE_DELIVERY_TIMEOUT_MS } from '../shared/constants';
import { sleepFor } from '../shared/promise_utils';
import { Global } from './locators';
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

/**
 * Send `message` from `sender` and wait for every window in `others` to have it.
 *
 * A run-breaker, not a conversational step. Desktop collapses consecutive messages from one sender
 * into a run and renders the author label on the FIRST of that run only — `MessageAuthorText` is
 * gated on `firstMessageOfSeries`, which is decided purely by comparing the previous message's
 * sender, with no time window (`ts/state/selectors/conversations.ts`). So two messages from the same
 * person back to back produce exactly ONE author label, and any spec asserting on the label of the
 * second needs somebody else to speak in between.
 *
 * The wait is what makes it a break rather than a race: the sender's next message has to be ordered
 * after this one for the clients to draw them in that order, and every other window already holding
 * this one is what guarantees it.
 */
export async function breakTheRun(
  sender: DesktopWrapper,
  others: Array<DesktopWrapper>,
  message: string
) {
  await sender.sendMessage(message);
  await Promise.all(
    others.map(other => other.waitForMessage(message, MESSAGE_DELIVERY_TIMEOUT_MS))
  );
}

/**
 * How long each status is allowed to take, because they are not the same kind of wait.
 *
 * `sent` and `failed` are local transitions — the client decides them, so a slow one is a real problem and
 * a tight bound reports it quickly. `read` needs a receipt to reach the recipient, be acted on, and travel
 * back, so it is bounded by the network rather than by this client.
 *
 * Measured on devnet across three runs: 31s once, and over 60s on another — so the cost is not fixed, and
 * a bound sized from one sample is not enough. 90s is the only value observed to pass. The old shared
 * ceiling was 20s, and its comment ("a gif on mainnet can take a long time to upload") was written for
 * attachment uploads and never revisited for receipts.
 *
 * The spread is worth understanding rather than absorbing: a 2x range suggests the receipt waits on a poll
 * cycle rather than on network latency, in which case the right bound is one poll interval and this number
 * should be derived rather than observed.
 */
const STATUS_TIMEOUT_MS: Record<MessageStatus, number> = {
  failed: 20_000,
  sent: 20_000,
  read: 90_000,
};

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
    timeout: STATUS_TIMEOUT_MS[status],
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
