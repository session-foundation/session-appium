import { TestInfo } from '@playwright/test';
import * as fs from 'fs';
import looksSame from 'looks-same';
import { randomUUID } from 'node:crypto';
import * as path from 'path';
import sharp from 'sharp';
import { ssim } from 'ssim.js';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { ScreenshotFileNames } from '../../types/testing';
import { SupportedPlatformsType } from './open_app';
import { getDiffDirectory } from './utilities';
import { clearStatusBarOverrides, setConsistentStatusBar } from './utilities';

type Attachment = {
  name: string;
  body: Buffer | string;
  contentType: string;
};

interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

async function pushAttachmentsToReport(
  testInfo: TestInfo,
  attachments: Attachment[]
): Promise<void> {
  for (const { name, body, contentType } of attachments) {
    await testInfo.attach(name, { body, contentType });
  }
}

/**
 * Converts image buffer to SSIM-compatible ImageData format
 */
async function bufferToImageData(imageBuffer: Buffer): Promise<ImageData> {
  return toImageData(sharp(imageBuffer));
}

/**
 * Converts file path to SSIM-compatible ImageData format
 */
async function fileToImageData(filePath: string): Promise<ImageData> {
  return toImageData(sharp(filePath));
}

/**
 * The share of the frame's height taken off the bottom before comparing.
 *
 * The home indicator lives there, it auto-hides on its own schedule, and whether it is drawn at the
 * instant of capture has nothing to do with the app. Measured on a failing `app_disguise` comparison:
 * 6433 differing pixels, 0.203% of the frame, ALL of them in a 15px band 25-39px from the bottom, with
 * every icon, label and control byte-identical. SSIM is structural rather than per-pixel, so a
 * high-contrast bar appearing in an otherwise flat black region cost 1.7% of the score — enough to fail
 * a spec held at 0.99.
 *
 * A fraction rather than a pixel count, so it holds across device scales. Both sides are cropped at
 * comparison time, which leaves the stored baselines untouched.
 */
const OS_CHROME_BOTTOM_FRACTION = 0.02;

async function toImageData(image: sharp.Sharp): Promise<ImageData> {
  const { width, height } = await image.metadata();
  const keptHeight = height - Math.ceil(height * OS_CHROME_BOTTOM_FRACTION);
  const rawBuffer = await image
    .extract({ left: 0, top: 0, width, height: keptHeight })
    .raw()
    .toBuffer();

  return {
    data: new Uint8ClampedArray(rawBuffer),
    width,
    height: keptHeight,
  };
}

/**
 * Performs SSIM comparison with optional fallback to looks-same for diff generation
 * SSIM focuses on structural similarity rather than pixel-perfect matching, making it
 * robust to minor rendering differences while still catching layout changes
 */
async function compareWithSSIM(
  actualBuffer: Buffer,
  baselineImagePath: string,
  testInfo: TestInfo,
  threshold: number
): Promise<void> {
  const actualImageData = await bufferToImageData(actualBuffer);
  const baselineImageData = await fileToImageData(baselineImagePath);

  // Check dimensions match
  if (
    actualImageData.width !== baselineImageData.width ||
    actualImageData.height !== baselineImageData.height
  ) {
    throw new Error(
      `Image dimensions don't match: baseline ${baselineImageData.width}x${baselineImageData.height}, actual ${actualImageData.width}x${actualImageData.height}`
    );
  }

  const { mssim } = ssim(actualImageData, baselineImageData);
  console.log(`SSIM similarity score: ${mssim.toFixed(4)}`);

  if (mssim < threshold) {
    // Generate visual diff for debugging
    const uuid = randomUUID();
    const diffsDir = getDiffDirectory();
    const actualPath = path.join(diffsDir, `${uuid}_actual.png`);
    const diffPath = path.join(diffsDir, `${uuid}_diff.png`);

    fs.writeFileSync(actualPath, actualBuffer);

    try {
      const { diffImage } = await looksSame(actualPath, baselineImagePath, {
        createDiffImage: true,
      });

      if (diffImage) {
        await diffImage.save(diffPath);
        console.log(`Visual diff saved to: ${diffPath}`);
      }

      // Attach artifacts to report
      if (process.env.ALLURE_ENABLED === 'true' && process.env.CI === '1') {
        const baselineBase64 = fs.readFileSync(baselineImagePath).toString('base64');
        const diffBase64 = fs.readFileSync(diffPath).toString('base64');
        const actualBase64 = actualBuffer.toString('base64');
        const visualDiffPayload = {
          actual: `data:image/png;base64,${actualBase64}`,
          expected: `data:image/png;base64,${baselineBase64}`,
          diff: `data:image/png;base64,${diffBase64}`,
        };

        await pushAttachmentsToReport(testInfo, [
          {
            name: 'Visual Comparison',
            body: Buffer.from(JSON.stringify(visualDiffPayload), 'utf-8'),
            contentType: 'application/vnd.allure.image.diff',
          },
          {
            name: 'Baseline Screenshot',
            body: Buffer.from(baselineBase64, 'base64'),
            contentType: 'image/png',
          },
          {
            name: 'Actual Screenshot',
            body: Buffer.from(actualBase64, 'base64'),
            contentType: 'image/png',
          },
          {
            name: 'Diff Screenshot',
            body: Buffer.from(diffBase64, 'base64'),
            contentType: 'image/png',
          },
        ]);
      }
    } catch (error) {
      console.warn('Error processing visual diff', error);
    }

    console.log(`SSIM similarity score ${mssim.toFixed(4)} below threshold ${threshold}`);
    throw new Error('The observed UI does not match the expected baseline');
  }
}

/**
 * Handles baseline creation for development
 */
function ensureBaseline(actualBuffer: Buffer, baselinePath: string): void {
  if (!fs.existsSync(baselinePath)) {
    const diffsDir = getDiffDirectory();
    const uuid = randomUUID();
    const tempPath = path.join(diffsDir, `${uuid}_new_baseline.png`);
    fs.writeFileSync(tempPath, actualBuffer);

    if (process.env.UPDATE_BASELINES === 'true') {
      fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
      fs.writeFileSync(baselinePath, actualBuffer);
      throw new Error(`No baseline image found. Auto-saved new baseline at: ${baselinePath}`);
    }

    throw new Error(
      `No baseline image found. Screenshot saved at: ${tempPath}.\nSet UPDATE_BASELINES=true to auto-save baselines.`
    );
  }
}

/**
 * Takes a full page screenshot and verifies it against a saved baseline image using SSIM.
 */
export async function verifyPageScreenshot(
  device: DeviceWrapper,
  platform: SupportedPlatformsType,
  screenshotName: ScreenshotFileNames,
  testInfo: TestInfo,
  threshold: number = 0.97 // Strict tolerance by default
): Promise<void> {
  // Validate threshold range
  if (threshold < 0 || threshold > 1) {
    throw new Error(`SSIM threshold must be between 0 and 1, got: ${threshold}`);
  }
  await setConsistentStatusBar(device);
  // Dismissed for the same reason the status bar is pinned: it is chrome the OS owns, not state the app
  // decides, so it moves under a baseline without the app changing. Its layout differs between iOS
  // runtimes — one extra key shifts every row below it — and no screenshot spec here is asserting
  // anything about a keyboard.
  //
  // Best-effort: `hideKeyboard` treats "there was none" as the desired end state, so a screen without one
  // is unaffected.
  await device.hideKeyboard({ tapOutsideTheInput: true });
  try {
    // Get full page screenshot and crop it
    const pageScreenshotBase64 = await device.getScreenshot();
    const screenshotBuffer = Buffer.from(pageScreenshotBase64, 'base64');

    // Get baseline path and ensure it exists
    const baselineScreenshotPath = path.join(
      'run',
      'screenshots',
      platform,
      `${screenshotName}.png`
    );
    ensureBaseline(screenshotBuffer, baselineScreenshotPath);

    // Perform SSIM comparison
    await compareWithSSIM(screenshotBuffer, baselineScreenshotPath, testInfo, threshold);
  } finally {
    await clearStatusBarOverrides(device);
  }
}
