import looksSame from 'looks-same';
import * as fs from 'fs';
import * as path from 'path';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LocatorsInterfaceScreenshot } from '../locators';
import { v4 as uuidv4 } from 'uuid';
import { PageName } from '../../../types/testing';
import { BrowserPageScreenshot } from './screenshot_paths';
import { SupportedPlatformsType } from './open_app';

// The function takes a screenshot of an element and verifies it against a baseline screenshot
// Supports locators with optional multiple states, enforcing correct state usage where applicable
// If no baseline is available, the element screenshot is retained for potential future use as a new baseline
// The baseline images were taken on a Pixel 6 (1080x2061) and an iPhone 15 Pro Max (1290x2462)
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
  const diffsDir = path.join('test-results', 'diffs');
  fs.mkdirSync(diffsDir, { recursive: true });
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
  const uuid = uuidv4();
  //  Create file path for the diff image (if doesn't exist)
  const diffsDir = path.join('test-results', 'diffs');
  fs.mkdirSync(diffsDir, { recursive: true });
  // Capture screenshot
  const screenshotBase64 = await device.getScreenshot();
  // Convert the base64 string to a Buffer
  const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');
  // Create file path for the screenshot
  const screenshotName = path.join(diffsDir, `${uuid}_screenshot.png`);
  // Save the screenshot to disk
  fs.writeFileSync(screenshotName, screenshotBuffer);
  // Create custom file path for the baseline screenshot
  const screenshotPath = new BrowserPageScreenshot();
  const baselinePath = screenshotPath.screenshotFileName(platform, page);

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  // if there _isn’t_ a baseline yet, create it now and exit cleanly
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, screenshotBuffer);
    console.warn(`No baseline existed – created new baseline for "${page}" at:\n  ${baselinePath}`);
    return;
  }
  // otherwise compare against the existing baseline
  const { equal, diffImage } = await looksSame(screenshotName, baselinePath, {
    createDiffImage: true,
  });

  if (!equal) {
    const diffImagePath = path.join(diffsDir, `${uuid}_diff.png`);
    await diffImage.save(diffImagePath);
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
