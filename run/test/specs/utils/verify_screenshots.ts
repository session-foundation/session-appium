import looksSame from 'looks-same';
import * as fs from 'fs';
import test from '@playwright/test';
import * as path from 'path';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LocatorsInterface } from '../locators';
import { StrategyExtractionObj } from '../../../types/testing';
import { ScreenshotFileNames } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';

// Ensure only valid baseline screenshot paths are accepted
type BaselineScreenshotPath =
  `run/screenshots/${SupportedPlatformsType}/${ScreenshotFileNames}.png`;

// The function takes a screenshot of an element and verifies it against a baseline screenshot
// If no baseline is available, the element screenshot is retained so that it could be used as a new baseline
// The baseline images were taken on a Pixel 6 and an iPhone 15 Pro Max
export async function verifyElementScreenshot(
  device: DeviceWrapper,
  element: {
    text?: string;
    maxWait?: number;
  } & (StrategyExtractionObj | LocatorsInterface),
  baselineScreenshotPath: BaselineScreenshotPath
): Promise<void> {
  // Using Playwright's default test-results folder ensures cleanup at the beginning of each run
  const diffsDir = 'test-results/diffs';
  fs.mkdirSync(diffsDir, { recursive: true });
  // Get the element screenshot as base64
  const elementToScreenshot = await device.waitForTextElementToBePresent(element);
  const elementScreenshotBase64: string = await device.getElementScreenshot(
    elementToScreenshot.ELEMENT
  );
  // Convert the base64 string to a Buffer and save it to disk as a png
  const elementScreenshotPath = path.join(diffsDir, `screenshot_${test.info().title}.png`);
  const screenshotBuffer = Buffer.from(elementScreenshotBase64, 'base64');
  fs.writeFileSync(elementScreenshotPath, screenshotBuffer);
  // Check if baseline screenshot exists
  if (!fs.existsSync(baselineScreenshotPath)) {
    throw new Error(
      `No baseline image found at: ${baselineScreenshotPath}. A new screenshot has been saved at: ${elementScreenshotPath}`
    );
  }
  // Use looks-same to verify the element screenshot against the baseline
  const { equal, diffImage } = await looksSame(elementScreenshotPath, baselineScreenshotPath, {
    createDiffImage: true,
  });
  if (!equal) {
    const diffImagePath = path.join(diffsDir, `diffImage_${test.info().title}.png`);
    await diffImage.save(diffImagePath);
    throw new Error(`The images do not match. The diff has been saved to ${diffImagePath}`);
  }
  // Cleanup of element screenshot file on success
  try {
    fs.unlinkSync(elementScreenshotPath);
    console.log('Temporary screenshot deleted successfully');
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error deleting file: ${err.message}`);
    }
  }
}
