// @ported-from tests/automation/utilities/screenshot.ts
// @port-kind   verbatim
import type { ElementHandle, TestInfo } from '@playwright/test';

import { expect } from '@playwright/test';
import fs from 'node:fs';

import { sleepFor } from './promise_utils';

export type ScreenshotComparisonOptions = {
  element: ElementHandle;
  snapshotName: string;
  testInfo: TestInfo;
  maxRetryDurationMs?: number;
  imageType?: 'jpeg' | 'png';
  maxDiffPixelRatio?: number;
};

/**
 * Takes a screenshot of an element and compares it against a baseline snapshot.
 * Retries until the screenshot matches or timeout is reached.
 *
 * @param options - Screenshot comparison configuration
 * @throws Error if screenshot doesn't match within the retry duration
 */
export async function compareElementScreenshot(
  options: ScreenshotComparisonOptions,
): Promise<void> {
  const MAX_RETRY_DURATION_MS = 20_000;
  const POLL_INTERVAL_MS = 500; // Retry every 500ms
  const MAX_DIFF_PIXEL_RATIO = 0.02; // Allow 2% of pixel differences
  const {
    element,
    snapshotName,
    testInfo,
    maxRetryDurationMs = MAX_RETRY_DURATION_MS,
    imageType = 'jpeg',
    maxDiffPixelRatio = MAX_DIFF_PIXEL_RATIO,
  } = options;

  // Check if snapshot file exists
  const snapshotPath = testInfo.snapshotPath(snapshotName);
  const snapshotExists = fs.existsSync(snapshotPath);

  // If there's no snapshot available, let UI settle before taking a candidate baseline snapshot
  // (e.g. display picture syncing to linked device)
  // Playwright saves missing snapshots by default (updateSnapshots = 'missing')
  if (!snapshotExists) {
    console.log('No baseline screenshot available');
    await sleepFor(15_000, true);
  }

  // Poll for MAX_RETRY_DURATION_MS and attempt to match every POLL_INTERVAL_MS
  const start = Date.now();
  let tryNumber = 0;
  let lastError: Error | undefined;

  let lastScreenshot: Buffer<ArrayBufferLike> | undefined;

  while (Date.now() - start <= maxRetryDurationMs) {
    try {
      lastScreenshot = await element.screenshot({
        type: imageType,
      });

      expect(lastScreenshot).toMatchSnapshot({
        name: snapshotName,
        maxDiffPixelRatio,
      });

      return;
    } catch (e) {
      lastError = e as Error;
      tryNumber++;

      // Wait between attempts if we haven't exceeded timeout
      if (Date.now() - start + POLL_INTERVAL_MS <= maxRetryDurationMs) {
        await sleepFor(POLL_INTERVAL_MS);
      }
    }
  }

  if (lastScreenshot) {
    // save the snapshot to a temp folder for inspection
    const tempPath = testInfo.snapshotPath(`temp-${snapshotName}`);
    fs.writeFileSync(tempPath, lastScreenshot);
    console.error(
      `Screenshot matching of "${snapshotName}" failed after ${tryNumber} attempt(s) (${maxRetryDurationMs}ms)`,
    );
    console.warn(`\n\texpected:${snapshotPath}\n\treceived: ${tempPath}`);
  }

  // Only reach here if we timed out
  console.error(
    `Screenshot matching of "${snapshotName}" failed after ${tryNumber} attempt(s) (${maxRetryDurationMs}ms)`,
  );
  throw (
    lastError ?? new Error('Screenshot comparison failed without error details')
  );
}
