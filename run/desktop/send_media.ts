import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { sleepFor } from '../shared/promise_utils';
import { testLinkTitle } from './constants/variables';
import { Conversation, Global, Settings } from './locators';
import { waitForMessageStatus } from './message';
import { MediaType } from './types';
import {
  checkModalStrings,
  clickOn,
  clickOnElement,
  clickOnMatchingText,
  clickOnWithText,
  controlOrMetaFor,
  pasteIntoInput,
  waitForTestIdWithText,
  waitForTextMessage,
} from './utils';

/**
 * Verify media preview loaded by checking screenshot buffer size
 * Pixel matching and other image metadata approaches were all too unreliable.
 * A broken image has the exact same appearance in the DOM as a loaded one.
 * Waits for loading animation to finish before checking
 * Throws if media fails to load
 */
export const verifyMediaPreviewLoaded = async (
  page: Page,
  textMessage: string,
  timeout = 10_000,
  sampleIntervalMs = 150
): Promise<void> => {
  const brokenFileSizeThreshold = 5_000; // 5 kB is considered broken
  console.log(`Verifying media preview for: "${textMessage}"`);

  await waitForTextMessage(page, textMessage);

  const container = page
    .locator('[data-testid="message-content"]')
    .filter({ hasText: textMessage });

  const media = container.locator('[data-attachmentindex="0"]');
  await media.waitFor({ state: 'visible', timeout: 5000 });

  const spinner = media.locator('[data-testid="loading-animation"]');
  if (await spinner.count()) {
    await spinner.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  const img = media.locator('img.module-image__image').first();

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const src = await img.getAttribute('src');
    if (src) {
      await sleepFor(500); // Allow time for image to fully load
      const screenshot = await img.screenshot({ type: 'png' });
      if (screenshot.length >= brokenFileSizeThreshold) {
        console.log(`✓ Media loaded (PNG ${screenshot.length} bytes)`);
        return;
      }
    }
    await sleepFor(sampleIntervalMs);
  }

  throw new Error(`Media preview failed to load within ${timeout}ms`);
};

export const sendMedia = async (
  window: Page,
  path: string,
  testMessage: string,
  shouldCheckMediaPreview: boolean = false
) => {
  // Send media
  await window.setInputFiles("input[type='file']", path);
  await pasteIntoInput(window, 'message-input-text-area', testMessage);
  // make sure that both the staged attachment container and message content we expect are there before we hit "send"
  await Promise.all([
    waitForTestIdWithText(window, 'message-input-text-area', testMessage, 1000),
    waitForTestIdWithText(window, 'staged-attachments-container', undefined, 1000),
  ]);
  await clickOnElement({
    window,
    strategy: 'data-testid',
    selector: 'send-message-button',
  });
  await waitForMessageStatus(window, testMessage, 'sent');
  if (shouldCheckMediaPreview) {
    await verifyMediaPreviewLoaded(window, testMessage);
  }
};

export const sendVoiceMessage = async (window: Page) => {
  await clickOn(window, Conversation.microphoneButton);
  await clickOn(window, Global.toast);
  await clickOn(window, Settings.enableMicrophone);
  await clickOn(window, Global.modalCloseButton);
  await clickOn(window, Conversation.microphoneButton);
  await sleepFor(5000);
  await clickOn(window, Conversation.endVoiceMessageButton);
  await sleepFor(4000);
  await clickOnElement({
    window,
    strategy: 'data-testid',
    selector: 'send-message-button',
  });
  const selc = `css=[data-testid=msg-status][data-testtype=sent]`;
  await window.waitForSelector(selc, {
    timeout: 30000,
  });
};

export const sendLinkPreview = async (window: Page, testLink: string) => {
  // The clipboard is shared across the system so multiple tests can write to it and break each others.
  // I have made the copy and paste as fast as possible here so that this happens as little as possible.
  await pasteIntoInput(window, 'search-input', testLink);
  await clickOnElement({
    window,
    strategy: 'data-testid',
    selector: 'search-input',
  });

  // Need to copy link to clipboard, as the enable link preview modal
  // doesn't pop up if manually typing link (needs to be pasted)
  await window.keyboard.press(`${controlOrMetaFor()}+A`);
  await window.keyboard.press(`${controlOrMetaFor()}+X`);
  await sleepFor(100);
  await clickOn(window, Conversation.messageInput);
  await sleepFor(100);
  await window.keyboard.press(`${controlOrMetaFor()}+V`);
  await checkModalStrings(
    window,
    tStripped('linkPreviewsEnable'),
    tStripped('linkPreviewsFirstDescription')
  );
  await clickOnWithText(window, Global.confirmButton, tStripped('enable'));

  await waitForTestIdWithText(window, 'link-preview-image');
  await waitForTestIdWithText(window, 'link-preview-title', testLinkTitle);
  await clickOnElement({
    window,
    strategy: 'data-testid',
    selector: 'send-message-button',
  });

  await waitForMessageStatus(window, testLink, 'sent');
};

export const trustUser = async (window: Page, mediaType: MediaType, userName: string) => {
  await clickOnMatchingText(
    window,
    tStripped('attachmentsClickToDownload', {
      file_type: tStripped(mediaType).toLowerCase(),
    })
  );
  await checkModalStrings(
    window,
    tStripped('attachmentsAutoDownloadModalTitle'),
    tStripped('attachmentsAutoDownloadModalDescription', {
      conversation_name: userName,
    })
  );
  await clickOnWithText(window, Global.confirmButton, tStripped('yes'));
};
