import { TestInfo } from '@playwright/test';
import * as fs from 'fs';
import looksSame from 'looks-same';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LocatorsInterfaceScreenshot } from '../locators';
import { SupportedPlatformsType } from './open_app';
import { getDiffDirectory } from './utilities';

type Attachment = {
  name: string;
  body: Buffer | string;
  contentType: string;
};

export async function pushAttachmentsToReport(
  testInfo: TestInfo,
  attachments: Attachment[]
): Promise<void> {
  for (const { name, body, contentType } of attachments) {
    await testInfo.attach(name, { body, contentType });
  }
}

/**
 * Crops screenshot to remove dynamic status bar elements (time, battery, signal)
 * and other variable UI elements that cause false positives in visual comparisons
 * NOTE: If cropping becomes unreliable there are methods to manipulate iOS and Android status bars
 */
async function cropScreenshot(_device: DeviceWrapper, screenshotBuffer: Buffer): Promise<Buffer> {
  const image = sharp(screenshotBuffer);
  const { width, height } = await image.metadata();
  const cropTop = 150;
  const cropLeft = 5; // I was getting weird rendering artifacts on the edges
  const cropRight = 5;
  const cropWidth = width - cropRight;
  const cropHeight = height - cropTop;

  return sharp(screenshotBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .blur() // This blur is imperceptible but gets rid of all the antialiasing issues
    .toBuffer();
}

/**
 * Shared logic for screenshot comparison and Allure reporting
 */
async function compareScreenshots(
  actualScreenshotBuffer: Buffer,
  baselineScreenshotPath: string,
  uuid: string,
  testInfo: TestInfo,
  tolerance?: number
): Promise<void> {
  const diffsDir = getDiffDirectory();
  const actualScreenshotPath = path.join(diffsDir, `${uuid}_screenshot.png`);
  fs.writeFileSync(actualScreenshotPath, actualScreenshotBuffer);

  // Check if baseline exists
  if (!fs.existsSync(baselineScreenshotPath)) {
    // For local development you can uncomment these lines to auto-save baselines at the correct location
    // fs.mkdirSync(path.dirname(baselineScreenshotPath), { recursive: true });
    // fs.writeFileSync(baselineScreenshotPath, actualScreenshotBuffer);
    throw new Error(
      `No baseline image found at: ${baselineScreenshotPath}. A new screenshot has been saved at: ${actualScreenshotPath}`
    );
  }

  // Compare screenshots
  console.log('Attempting visual comparison...');
  const { equal, diffImage } = await looksSame(actualScreenshotPath, baselineScreenshotPath, {
    createDiffImage: true,
    tolerance: tolerance,
  });
  if (!equal) {
    const diffImagePath = path.join(diffsDir, `${uuid}_diffImage.png`);
    await diffImage.save(diffImagePath);

    // For the CI, create a visual diff that renders in the Allure report
    if (process.env.ALLURE_ENABLED === 'true' && process.env.CI === '1') {
      // Load baseline and diff images
      const baselineBase64 = fs.readFileSync(baselineScreenshotPath).toString('base64');
      const diffBase64 = fs.readFileSync(diffImagePath).toString('base64');
      const actualBase64 = actualScreenshotBuffer.toString('base64');

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
          body: actualScreenshotBuffer,
          contentType: 'image/png',
        },
        {
          name: 'Diff Screenshot',
          body: Buffer.from(diffBase64, 'base64'),
          contentType: 'image/png',
        },
      ]);
    }

    console.log(`Visual comparison failed. The diff has been saved to ${diffImagePath}`);
    throw new Error(`The UI doesn't match expected appearance`);
  }

  // Cleanup on success
  try {
    fs.unlinkSync(actualScreenshotPath);
    console.log('Temporary screenshot deleted successfully');
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error deleting file: ${err.message}`);
    }
  }
}

/**
 * Takes a screenshot of a UI element and verifies it against a saved baseline image.
 *
 * Requires Playwright's `testInfo` for attaching visual comparison artifacts to the test report.
 * Supports locators with multiple states; enforces correct state usage via type constraints.
 * If no baseline image exists, the element screenshot is saved and an error is thrown.
 * On mismatch, a pixel-by-pixel comparison is performed and a visual diff is attached (when CI + ALLURE_ENABLED).
 * Baseline screenshots are assumed to have been taken on: Pixel 6 (1080x2061) and iPhone 16 Pro Max (1320x2868)
 *
 * Example usage:
 * // Locator with multiple states:
 * await verifyElementScreenshot(device, new EmptyLandingPageScreenshot(device), testInfo, 'new_account');
 *
 * // Locator with a single state:
 * await verifyElementScreenshot(device, new SomeSimpleLocatorScreenshot(device), testInfo);
 */
export async function verifyElementScreenshot<
  T extends LocatorsInterfaceScreenshot & { screenshotFileName: (...args: any[]) => string },
>(
  device: DeviceWrapper,
  element: T,
  testInfo: TestInfo,
  ...args: Parameters<T['screenshotFileName']> // Enforces states when mandatory
): Promise<void> {
  const uuid = uuidv4();

  // Get the element screenshot as base64
  const elementToScreenshot = await device.waitForTextElementToBePresent(element);
  const elementScreenshotBase64: string = await device.getElementScreenshot(
    elementToScreenshot.ELEMENT
  );

  // Convert the base64 string to a Buffer
  let screenshotBuffer: Buffer = Buffer.from(elementScreenshotBase64, 'base64');
  screenshotBuffer = await sharp(screenshotBuffer).blur().png().toBuffer(); // Imperceptible blur to reduce antialiasing issues

  // Use shared comparison logic
  const baselineScreenshotPath = element.screenshotFileName(...args);
  await compareScreenshots(screenshotBuffer, baselineScreenshotPath, uuid, testInfo);
}

/**
 * Takes a full page screenshot and verifies it against a saved baseline image.
 *
 * Uses the same comparison logic as verifyElementScreenshot but captures the entire
 * viewport and applies cropping to remove dynamic elements like status bar indicators.
 *
 * Requires Playwright's `testInfo` for attaching visual comparison artifacts to the test report.
 * If no baseline image exists, the page screenshot is saved and an error is thrown.
 * On mismatch, a pixel-by-pixel comparison is performed and a visual diff is attached (when CI + ALLURE_ENABLED).
 *
 * Example usage:
 * await verifyPageScreenshot(device, platform, 'screenshotName', testInfo);
 */
export async function verifyPageScreenshot(
  device: DeviceWrapper,
  platform: SupportedPlatformsType,
  screenshotName: string,
  testInfo: TestInfo
): Promise<void> {
  const uuid = uuidv4();
  const baselineScreenshotPath = path.join('run', 'screenshots', platform, `${screenshotName}.png`);

  // Get full page screenshot and crop it
  const pageScreenshotBase64 = await device.getScreenshot();
  const screenshotBuffer = Buffer.from(pageScreenshotBase64, 'base64');
  const croppedBuffer = await cropScreenshot(device, screenshotBuffer);

  await compareScreenshots(croppedBuffer, baselineScreenshotPath, uuid, testInfo, 5); // Slightly higher tolerance for full page screenshots
}
