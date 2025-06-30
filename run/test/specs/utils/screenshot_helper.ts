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
  deviceRegistry.set(testId, { devices, testInfo, platform });
}

// Unregister devices after test
export function unregisterDevicesForTest(testInfo: TestInfo) {
  const testId = `${testInfo.testId}-${testInfo.repeatEachIndex}`;
  deviceRegistry.delete(testId);
}
// Add device labels to screenshots (e.g. "Device: alice1")
async function addDeviceLabel(screenshot: Buffer, device: DeviceWrapper): Promise<Buffer> {
  const metadata = await sharp(screenshot).metadata();
  const width = metadata.width;
  const deviceName = device.getDeviceIdentity();

  // Create transparent label overlay
  const labelHeight = 60;
  const fontSize = 28;
  const label = Buffer.from(`
    <svg width="${width}" height="${labelHeight}">
      <rect x="0" y="0" width="${width}" height="${labelHeight}"
            fill="black" fill-opacity="0"/>
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

async function createSideBySideComposite(left: Buffer, right: Buffer): Promise<Buffer> {
  try {
    // Get dimensions of first image
    const metadata = await sharp(left).metadata();
    const width = metadata.width;

    // Extend first image to the right and composite second
    const composite = await sharp(left)
      .extend({
        right: width + 2, // 2px gap
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .composite([
        {
          input: right,
          left: width + 2,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    return composite;
  } catch (error) {
    console.error('Failed to create side-by-side composite:', error);
    throw error;
  }
}

// 2x2 grid composite for 3-4 devices
// Layout:
// [Device 1] [Device 2]
// [Device 3] [Device 4]
async function createGridComposite(screenshots: Buffer[]): Promise<Buffer> {
  try {
    // Get dimensions from first screenshot
    const metadata = await sharp(screenshots[0]).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const gap = 2;

    // Start with first screenshot and extend to create grid space
    let composite = await sharp(screenshots[0])
      .extend({
        right: width + gap,
        bottom: height + gap,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();

    // Position remaining screenshots
    const overlays = [];

    // Top right (device 2)
    if (screenshots[1]) {
      overlays.push({
        input: screenshots[1],
        left: width + gap,
        top: 0,
      });
    }

    // Bottom left (device 3)
    if (screenshots[2]) {
      overlays.push({
        input: screenshots[2],
        left: 0,
        top: height + gap,
      });
    }

    // Bottom right (device 4)
    if (screenshots[3]) {
      overlays.push({
        input: screenshots[3],
        left: width + gap,
        top: height + gap,
      });
    }

    // Apply all overlays
    if (overlays.length > 0) {
      composite = await sharp(composite).composite(overlays).png().toBuffer();
    }

    return composite;
  } catch (error) {
    console.error('Failed to create grid composite:', error);
    throw error;
  }
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
    let finalImage: Buffer;

    switch (screenshots.length) {
      case 1:
        finalImage = screenshots[0];
        break;
      case 2:
        finalImage = await createSideBySideComposite(screenshots[0], screenshots[1]);
        break;
      case 3:
      case 4:
        finalImage = await createGridComposite(screenshots);
        break;
      default:
        // Fallback for > 4 devices
        console.log('More than 4 devices detected, using first device screenshot only');
        finalImage = screenshots[0];
    }

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
