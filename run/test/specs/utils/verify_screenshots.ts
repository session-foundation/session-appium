import * as fs from 'fs';
import looksSame from 'looks-same';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { PageName } from '../../../types/testing';
import { LocatorsInterfaceScreenshot } from '../locators';
import { SupportedPlatformsType } from './open_app';
import { BrowserPageScreenshot } from './screenshot_paths';
import { cropScreenshot, getDiffDirectory, saveImage } from './utilities';
import { allure } from 'allure-playwright'


// The function takes a screenshot of an element and verifies it against a baseline screenshot
// Supports locators with optional multiple states, enforcing correct state usage where applicable
// If no baseline is available, the element screenshot is retained for potential future use as a new baseline
// The baseline images were taken on a Pixel 6 (1080x2061) and an iPhone 16 Pro Max (1320x2868)
//
// Example usage:
// Locator with multiple states;
// await verifyElementScreenshot(device, new EmptyLandingPageScreenshot(device), 'new_account');
// Locator with a single state:
// await verifyElementScreenshot(device, new SomeSimpleLocatorScreenshot(device));

export async function verifyElementScreenshot<
  T extends LocatorsInterfaceScreenshot & { screenshotFileName: (...args: any[]) => string },
>(
  device: DeviceWrapper,
  element: T,
  ...args: Parameters<T['screenshotFileName']> // Enforces states when mandatory
): Promise<void> {
  // Declaring a UUID in advance so that the diff and screenshot files are matched alphanumerically
  const uuid = uuidv4();
  // Using Playwright's default test-results folder ensures cleanup at the beginning of each run
  const diffsDir = getDiffDirectory();
  // Get the element screenshot as base64
  const elementToScreenshot = await device.waitForTextElementToBePresent(element);
  const elementScreenshotBase64: string = await device.getElementScreenshot(
    elementToScreenshot.ELEMENT
  );
  // Convert the base64 string to a Buffer and save it to disk as a png
  const elementScreenshotPath = path.join(diffsDir, `${uuid}_screenshot.png`);
  const screenshotBuffer = Buffer.from(elementScreenshotBase64, 'base64');
  fs.writeFileSync(elementScreenshotPath, screenshotBuffer);
  // Check if baseline screenshot exists
  const baselineScreenshotPath = element.screenshotFileName(...args);
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
    const diffImagePath = path.join(diffsDir, `${uuid}_diffImage.png`);
    await diffImage.save(diffImagePath);
    void allure.attachment(
      'Screenshot Diff', 
      fs.readFileSync(diffImagePath),
      'image/png'
    );
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
export async function verifyPageScreenshot(
  platform: SupportedPlatformsType,
  device: DeviceWrapper,
  page: PageName
): Promise<void> {
  //  Create file path for the diff image (if doesn't exist)
  const diffsDir = getDiffDirectory();
  // Capture screenshot
  const screenshotBase64 = await device.getScreenshot();
  const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');
  // Need to crop screenshot to cut out time
  const croppedBuf = await cropScreenshot(device, screenshotBuffer);
  // Create file path for the screenshot
  const screenshotName = await saveImage(croppedBuf, diffsDir, 'screenshot');
  // Create custom file path for the baseline screenshot
  const baselinePath = new BrowserPageScreenshot().screenshotFileName(platform, page);
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });

  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, croppedBuf);
    console.warn(`No baseline existed – created new baseline for "${page}" at:\n  ${baselinePath}`);
    return;
  }
  // otherwise compare against the existing baseline
  const { equal, diffImage } = await looksSame(croppedBuf, baselinePath, {
    createDiffImage: true,
  });

  if (!equal) {
    const diffImagePath = await saveImage(diffImage, diffsDir, 'diff');
    throw new Error(`Screenshot did not match baseline. Diff saved to:\n  ${diffImagePath}`);
  }
  // Cleanup of element screenshot file on success
  try {
    fs.unlinkSync(screenshotName);
    console.log('Temporary screenshot deleted successfully');
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error deleting file: ${err.message}`);
    }
  }
}
