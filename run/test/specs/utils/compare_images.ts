import looksSame from 'looks-same';
import * as fs from 'fs';
import test from '@playwright/test';
import * as path from 'path';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LocatorsInterface } from '../locators';
import { StrategyExtractionObj } from '../../../types/testing';

export async function saveAndCompare(
    device: DeviceWrapper,
    element: {
      text?: string;
      maxWait?: number;
    } & (StrategyExtractionObj | LocatorsInterface),
    filePath: string): Promise<void> {

    // Define temporary file storage location 
    const screenshotElement = await device.waitForTextElementToBePresent(element);
    const deviceScreenshotBase64: string = await device.getElementScreenshot(screenshotElement.ELEMENT);
    const outputDir = 'test-results/diffs'; // Directory to store diff images
    const diffImagePath = path.join(outputDir, `diffImage_${test.info().title}.png`); // Complete file path
    const savedScreenshotPath = path.join(outputDir, `screenshot_${test.info().title}.png`); // Full file path

    fs.mkdirSync(outputDir, { recursive: true });

    // Convert the Base64 string to a Buffer and save it to disk as a png
    const screenshotBuffer = Buffer.from(deviceScreenshotBase64, 'base64');
    fs.writeFileSync(savedScreenshotPath, screenshotBuffer);
    
    // Use looks-same to compare the saved screenshot with the reference image
    const {
        equal,
        diffImage,
    } = await looksSame(savedScreenshotPath, filePath, {strict: true, createDiffImage:true});
    if (!equal) {
        await diffImage.save(diffImagePath)
        throw new Error(`The images do not match. The diff has been saved to ${savedScreenshotPath}`)
    } else {        
        console.log(`The images match`)
        try {
            fs.unlinkSync(savedScreenshotPath);
            console.log('Temporary file deleted successfully');
          } catch (err) {
            if (err instanceof Error) {
              console.error(`Error deleting file: ${err.message}`);
            }
          }
    }
}
