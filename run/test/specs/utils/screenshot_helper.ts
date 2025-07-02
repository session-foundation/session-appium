import type { TestInfo } from '@playwright/test';

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { SupportedPlatformsType } from './open_app';

// Screenshot context type
type ScreenshotContext = {
  devices: DeviceWrapper[];
  testInfo: TestInfo;
  platform: SupportedPlatformsType;
};

// Global registry to track devices for screenshot capture
const deviceRegistry = new Map<string, ScreenshotContext>();

// Register devices for a test
export function registerDevicesForTest(
  testInfo: TestInfo,
  devices: DeviceWrapper[],
  platform: SupportedPlatformsType
) {
  const testId = `${testInfo.testId}-${testInfo.repeatEachIndex}`;
  // Throw if deviceRegistry already has an entry for this test
  // Could indicate that previous test did not unregister properly
  if (deviceRegistry.has(testId)) {
    throw new Error(`Device registry already contains entry for test "${testInfo.title}"`);
  }

  deviceRegistry.set(testId, { devices, testInfo, platform });
}

// Unregister devices after test
export function unregisterDevicesForTest(testInfo: TestInfo) {
  const testId = `${testInfo.testId}-${testInfo.repeatEachIndex}`;
  deviceRegistry.delete(testId);
}
// Add device labels to screenshots (e.g. "Device: alice1")
async function addDeviceLabel(screenshot: Buffer, device: DeviceWrapper): Promise<Buffer> {
  const { width } = await sharp(screenshot).metadata();
  const deviceName = device.getDeviceIdentity();

  // Create semi-transparent label overlay
  const labelHeight = 60;
  const fontSize = 28;
  const label = Buffer.from(`
    <svg width="${width}" height="${labelHeight}">
      <rect x="0" y="0" width="${width}" height="${labelHeight}"
            fill="black" fill-opacity="0.5"/>
      <text x="${width / 2}" y="${labelHeight / 2 + fontSize / 3}" 
            font-family="-apple-system, Arial, sans-serif" 
            font-size="${fontSize}" 
            font-weight="bold"
            fill="white" 
            text-anchor="middle">
         Device: ${deviceName}
      </text>
    </svg>
  `);

  // Composite label over screenshot
  return sharp(screenshot)
    .composite([
      {
        input: label,
        top: 0,
        left: 0,
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();
}

async function createComposite(screenshots: Buffer[]): Promise<Buffer> {
  if (screenshots.length === 0) {
    throw new Error('No screenshots provided');
  }
  
  if (screenshots.length === 1) {
    return screenshots[0];
  }
  
  if (screenshots.length > 4) {
    throw new Error(`Screenshot composition not supported for ${screenshots.length} devices. Maximum supported is 4.`);
  }
  
  // Get dimensions from first screenshot
  const { width, height } = await sharp(screenshots[0]).metadata();
  const gap = 2;
  
  // Calculate grid layout
  const cols = 2
  const rows = Math.ceil(screenshots.length / cols);
  
  // Calculate canvas size
  const canvasWidth = (width * cols) + (gap * (cols - 1));
  const canvasHeight = (height * rows) + (gap * (rows - 1));
  
  // Create base canvas with white background
  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });
  
  // Calculate positions and create composite array
  const composites = screenshots.map((screenshot, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * (width + gap);
    const y = row * (height + gap);
    
    return {
      input: screenshot,
      left: x,
      top: y
    };
  });
  
  // Apply all screenshots to canvas
  return canvas
    .composite(composites)
    .png()
    .toBuffer();
}

// Main screenshot capture function
export async function captureScreenshotsOnFailure(testInfo: TestInfo): Promise<void> {
  const testId = `${testInfo.testId}-${testInfo.repeatEachIndex}`;
  const context = deviceRegistry.get(testId);

  if (!context || context.devices.length === 0) {
    console.log('No devices registered for screenshot capture');
    return;
  }

  console.log(`Test failed, capturing screenshots from ${context.devices.length} device(s)...`);

  // Collect screenshots
  const screenshots: Buffer[] = [];

  for (let i = 0; i < context.devices.length; i++) {
    const device = context.devices[i];
    try {
      const screenshotBase64 = await device.getScreenshot();
      if (!screenshotBase64) continue;

      const rawScreenshot = Buffer.from(screenshotBase64, 'base64');

      // Add label to each screenshot
      const labeledScreenshot = await addDeviceLabel(rawScreenshot, device);
      screenshots.push(labeledScreenshot);

      console.log(`Captured and labeled screenshot from device ${device.getDeviceIdentity()}`);
    } catch (error) {
      console.error(
        `Failed to capture screenshot from device ${device.getDeviceIdentity()}:`,
        error
      );
    }
  }

  if (screenshots.length === 0) {
    console.log('No screenshots captured');
    return;
  }

  try {

    const finalImage = await createComposite(screenshots);

    // Strip everything after @ for a clean filename
    const testDesc = testInfo.title.split('@')[0].trim().toLowerCase();
    const cleanName = testDesc.replace(/[:\s]+/g, '-').replace(/-+/g, '-');
    const retry = testInfo.retry > 0 ? `-retry${testInfo.retry}` : '';
    const fileName = `${cleanName}${retry}.png`;

    // Ensure output directory exists
    await fs.promises.mkdir(testInfo.outputDir, { recursive: true });

    // Save locally
    const screenshotPath = path.join(testInfo.outputDir, fileName);
    await fs.promises.writeFile(screenshotPath, finalImage);
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Attach to report
    const attachmentName =
      screenshots.length === 1
        ? 'Test Failure Screenshot'
        : `Test Failure - ${screenshots.length} Devices`;

    await testInfo.attach(attachmentName, {
      body: finalImage,
      contentType: 'image/png',
    });
  } catch (error) {
    console.error('Failed to create screenshot:', error);
    // Fallback: attach individual screenshots
    for (let i = 0; i < screenshots.length; i++) {
      await testInfo.attach(`Device ${i + 1}`, {
        body: screenshots[i],
        contentType: 'image/png',
      });
    }
  }
}
