import type { ElementHandle, TestInfo } from '@playwright/test';

import { expect } from '@playwright/test';
import fs from 'node:fs';
import sharp from 'sharp';

import { sleepFor } from '../shared/promise_utils';

export type ScreenshotComparisonOptions = {
  element: ElementHandle;
  snapshotName: string;
  testInfo: TestInfo;
  maxRetryDurationMs?: number;
  imageType?: 'jpeg' | 'png';
  maxDiffPixelRatio?: number;
};

/**
 * Per-pixel YIQ tolerance used in place of Playwright's 0.2 when the capture had to be rescaled.
 *
 * Resampling softens every edge, so a rescaled capture is never identical to a natively drawn baseline
 * even when the UI is unchanged. Measured over the network-page baselines (153x135 against a 193x169
 * capture): at 0.2 a correct render already differs on up to 5.3% of pixels, past the 2% the comparison
 * allows; at 0.3 it differs on at most 1.2%, while a wrong node count still differs on 9.3% or more. The
 * gate keeps its meaning, it just stops charging for the resample.
 */
const RESCALED_PIXEL_THRESHOLD = 0.3;

/**
 * Playwright fails a comparison outright when the two images differ in size, and an element's pixel size
 * follows the display scale of the machine that captured it — these baselines were taken at 1.25x of what
 * a run here produces. Scaling the capture onto the baseline's grid keeps the comparison about what was
 * drawn rather than how many pixels it was drawn into.
 *
 * The capture is returned untouched when the sizes already agree, so a same-scale run compares the exact
 * bytes it always did.
 */
async function scaleToBaseline(
  screenshot: Buffer,
  baselinePath: string,
  imageType: 'jpeg' | 'png'
): Promise<{ screenshot: Buffer; rescaledFrom?: string }> {
  if (!fs.existsSync(baselinePath)) {
    return { screenshot };
  }

  const [captured, baseline] = await Promise.all([
    sharp(screenshot).metadata(),
    sharp(baselinePath).metadata(),
  ]);

  if (captured.width === baseline.width && captured.height === baseline.height) {
    return { screenshot };
  }

  // `fill` rather than sharp's default `cover`, which would crop to preserve the aspect ratio. An aspect
  // ratio that drifted is a difference the comparison should be shown, not one to crop away.
  const resized = sharp(screenshot).resize(baseline.width, baseline.height, { fit: 'fill' });

  return {
    // Full quality, so the resample is the only loss the comparison sees on top of the capture's own.
    screenshot: await (
      imageType === 'jpeg' ? resized.jpeg({ quality: 100 }) : resized.png()
    ).toBuffer(),
    rescaledFrom: `${captured.width}x${captured.height}`,
  };
}

/**
 * Takes a screenshot of an element and compares it against a baseline snapshot.
 * Retries until the screenshot matches or timeout is reached.
 *
 * @param options - Screenshot comparison configuration
 * @throws Error if screenshot doesn't match within the retry duration
 */
export async function compareElementScreenshot(
  options: ScreenshotComparisonOptions
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
  let lastRescaledFrom: string | undefined;

  while (Date.now() - start <= maxRetryDurationMs) {
    try {
      const captured = await element.screenshot({
        type: imageType,
      });

      const { screenshot, rescaledFrom } = await scaleToBaseline(captured, snapshotPath, imageType);
      lastScreenshot = screenshot;
      lastRescaledFrom = rescaledFrom;

      expect(lastScreenshot).toMatchSnapshot({
        name: snapshotName,
        maxDiffPixelRatio,
        ...(rescaledFrom ? { threshold: RESCALED_PIXEL_THRESHOLD } : {}),
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
      `Screenshot matching of "${snapshotName}" failed after ${tryNumber} attempt(s) (${maxRetryDurationMs}ms)`
    );
    console.warn(`\n\texpected:${snapshotPath}\n\treceived: ${tempPath}`);
    if (lastRescaledFrom) {
      console.warn(`\treceived was rescaled from ${lastRescaledFrom} to match the baseline`);
    }
  }

  // Only reach here if we timed out
  console.error(
    `Screenshot matching of "${snapshotName}" failed after ${tryNumber} attempt(s) (${maxRetryDurationMs}ms)`
  );
  throw lastError ?? new Error('Screenshot comparison failed without error details');
}
