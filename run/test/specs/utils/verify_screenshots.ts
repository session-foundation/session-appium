import { TestInfo } from '@playwright/test';
import * as fs from 'fs';
import looksSame from 'looks-same';
import * as path from 'path';
import sharp from 'sharp';
import { ssim } from 'ssim.js';
import { v4 as uuidv4 } from 'uuid';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { SupportedPlatformsType } from './open_app';
import { getDiffDirectory, runScriptAndLog } from './utilities';

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

/**
 * Eliminate any potential mismatches by mocking the status bar to always be the same
 */
async function setConsistentStatusBar(device: DeviceWrapper): Promise<void> {
  if (device.isIOS()) {
    // Time: 4:20, 100% battery, full wifi signal
    await runScriptAndLog(
      `xcrun simctl status_bar ${device.udid} override --time "04:20" --batteryLevel 100 --batteryState charged --wifiBars 3`,
      true
    );
  } else if (device.isAndroid()) {
    // Enable demo mode to set consistent status bar elements
    await runScriptAndLog(
      `adb -s ${device.udid} shell settings put global sysui_demo_allowed 1`,
      true
    );
    // Dismiss notifications
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false`,
      true
    );
    // Time: 4:20
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0420`,
      true
    );
    // 100% battery
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false`,
      true
    );
    // Full wifi (for some reason shows an ! next to the icon but that's fine)
    await runScriptAndLog(
      `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4`,
      true
    );
  }
}

async function clearStatusBarOverrides(device: DeviceWrapper): Promise<void> {
  try {
    if (device.isIOS()) {
      await runScriptAndLog(`xcrun simctl status_bar ${device.udid} clear`, true);
    } else if (device.isAndroid()) {
      await runScriptAndLog(
        `adb -s ${device.udid} shell am broadcast -a com.android.systemui.demo -e command exit`,
        true
      );
    }
  } catch (error) {
    console.warn('Failed to clear status bar overrides:', error);
    // Don't throw - this is cleanup, shouldn't fail the test
  }
}

export async function pushAttachmentsToReport(
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
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();
  const rawBuffer = await image.raw().toBuffer();

  return {
    data: new Uint8ClampedArray(rawBuffer),
    width: width,
    height: height,
  };
}

/**
 * Converts file path to SSIM-compatible ImageData format
 */
async function fileToImageData(filePath: string): Promise<ImageData> {
  const image = sharp(filePath);
  const { width, height } = await image.metadata();
  const rawBuffer = await image.raw().toBuffer();

  return {
    data: new Uint8ClampedArray(rawBuffer),
    width: width,
    height: height,
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
  threshold: number = 0.95
): Promise<void> {
  const actualImageData = await bufferToImageData(actualBuffer);
  const baselineImageData = await fileToImageData(baselineImagePath);

  // Check dimensions match
  if (
    actualImageData.width !== baselineImageData.width ||
    actualImageData.height !== baselineImageData.height
  ) {
    throw new Error(
      `Image dimensions don't match: actual ${actualImageData.width}x${actualImageData.height}, \n
      baseline ${baselineImageData.width}x${baselineImageData.height}`
    );
  }

  const { mssim } = ssim(actualImageData, baselineImageData);
  console.log(`SSIM similarity score: ${mssim.toFixed(4)}`);

  if (mssim < threshold) {
    // Generate visual diff for debugging
    const uuid = uuidv4();
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
    const uuid = uuidv4();
    const tempPath = path.join(diffsDir, `${uuid}_new_baseline.png`);
    fs.writeFileSync(tempPath, actualBuffer);

    // Uncomment these lines for local development to auto-create baselines
    // fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    // fs.writeFileSync(baselinePath, actualBuffer);

    throw new Error(
      `No baseline image found at: ${baselinePath}. \n
      A new screenshot has been saved at: ${tempPath}`
    );
  }
}

/**
 * Takes a full page screenshot and verifies it against a saved baseline image using SSIM.
 */
export async function verifyPageScreenshot(
  device: DeviceWrapper,
  platform: SupportedPlatformsType,
  screenshotName: string,
  testInfo: TestInfo
): Promise<void> {
  await setConsistentStatusBar(device);
  try {
    // Get full page screenshot and crop it
    const pageScreenshotBase64 = await device.getScreenshot();
    const screenshotBuffer = Buffer.from(pageScreenshotBase64, 'base64');
    // const croppedBuffer = await cropScreenshot(device, screenshotBuffer);

    // Get baseline path and ensure it exists
    const baselineScreenshotPath = path.join(
      'run',
      'screenshots',
      platform,
      `${screenshotName}.png`
    );
    ensureBaseline(screenshotBuffer, baselineScreenshotPath);

    // Perform SSIM comparison
    await compareWithSSIM(screenshotBuffer, baselineScreenshotPath, testInfo, 0.99);
  } finally {
    await clearStatusBarOverrides(device);
  }
}
