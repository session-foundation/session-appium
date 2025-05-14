import fs from 'fs/promises';
import * as path from 'path';
import { getImageOccurrence } from '@appium/opencv';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { clickOnCoordinates } from './click_by_coordinates';
import { StrategyExtractionObj } from '../../../types/testing';

// Visually match a reference image against one or more occurrences of an element
// If a match above the confidence threshold is found, taps the center of the matched region

export async function matchAndTapImage(
  device: DeviceWrapper,
  locator: StrategyExtractionObj,
  referenceImage: string
): Promise<void> {
  // Confidence threshold for image matching
  const threshold = 0.85;

  // Locate candidate elements to scan for a visual match
  const elements = await device.findElements(locator.strategy, locator.selector);
  // Load the reference image from disk - this can be the same image pushed or a thumbnail
  const filePath = path.join('run', 'test', 'specs', 'media', referenceImage);
  const referenceBuffer = await fs.readFile(filePath);

  // Attempt to match the reference image against each candidate element
  for (const el of elements) {
    const base64 = await device.getElementScreenshot(el.ELEMENT);
    const elementBuffer = Buffer.from(base64, 'base64');

    try {
      const { rect, score } = await getImageOccurrence(elementBuffer, referenceBuffer, {
        threshold: threshold,
      });
      // If match is above threshold, tap the center and return result
      if (score >= threshold) {
        const center = {
          x: rect.x + Math.floor(rect.width / 2),
          y: rect.y + Math.floor(rect.height / 2),
          confidence: score,
        };

        await clickOnCoordinates(device, center);
        console.log(`Image matched with ${(score * 100).toFixed(2)}%  confidence`);
        return;
      }
    } catch {
      // No match in this element — continue loop
    }
  }
  // No match found in any of the elements
  throw new Error(
    `No matching image found in ${elements.length} elements for ${locator.strategy} '${locator.selector}'`
  );
}
