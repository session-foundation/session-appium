import type { TestInfo } from '@playwright/test';

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { DeviceWrapper } from '../../types/DeviceWrapper';
import { getAdbFullPath } from './binaries';
import { iOSBundleId } from './capabilities_ios';
import { deviceRegistry, LogContext, registryKey } from './device_registry';
import { SupportedPlatformsType } from './open_app';
import { runScriptAndLog } from './utilities';

// --- Screenshots ---

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
    .composite([{ input: label, top: 0, left: 0, blend: 'over' }])
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
    throw new Error(
      `Screenshot composition not supported for ${screenshots.length} devices. Maximum supported is 4.`
    );
  }

  // Get dimensions from first screenshot
  const { width, height } = await sharp(screenshots[0]).metadata();
  const gap = 2;

  // Calculate grid layout
  const cols = 2;
  const rows = Math.ceil(screenshots.length / cols);

  // Calculate canvas size
  const canvasWidth = width * cols + gap * (cols - 1);
  const canvasHeight = height * rows + gap * (rows - 1);

  // Create base canvas with white background
  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  // Calculate positions and create composite array
  const composites = screenshots.map((screenshot, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return { input: screenshot, left: col * (width + gap), top: row * (height + gap) };
  });

  // Apply all screenshots to canvas
  return canvas.composite(composites).png().toBuffer();
}

// Main screenshot capture function
export async function captureScreenshotsOnFailure(testInfo: TestInfo): Promise<void> {
  const context = deviceRegistry.get(registryKey(testInfo));

  if (!context || context.devices.length === 0) {
    console.log('No devices registered for screenshot capture');
    return;
  }

  console.log(`Test failed, capturing screenshots from ${context.devices.length} device(s)...`);

  // Capture all raw screenshots in parallel
  const rawCaptures = await Promise.all(
    context.devices.map(async device => {
      try {
        const base64 = await device.getScreenshot();
        return { device, base64, success: true };
      } catch (error) {
        console.error(`Failed to capture from ${device.getDeviceIdentity()}:`, error);
        return { device, base64: null, success: false };
      }
    })
  );

  // Filter out failed captures
  const successfulCaptures = rawCaptures.filter(c => c.success && c.base64);
  if (successfulCaptures.length === 0) {
    console.log('No screenshots captured successfully');
    return;
  }
  // Process screenshots in parallel (labels + convert to Buffer)
  const processedResults = await Promise.allSettled(
    successfulCaptures.map(async ({ device, base64 }) => {
      const rawBuffer = Buffer.from(base64!, 'base64');
      const labeledBuffer = await addDeviceLabel(rawBuffer, device);
      console.log(`Processed screenshot from device ${device.getDeviceIdentity()}`);
      return { device, labeledBuffer };
    })
  );
  // Extract successful results and log failures
  const screenshots = processedResults
    .filter(
      (
        result
      ): result is PromiseFulfilledResult<{ device: DeviceWrapper; labeledBuffer: Buffer }> => {
        if (result.status === 'rejected') {
          console.error(`Failed to process screenshot:`, result.reason);
          return false;
        }
        return true;
      }
    )
    .map(result => result.value.labeledBuffer);

  if (screenshots.length === 0) {
    console.log('No screenshots processed successfully');
    return;
  }

  // Create composite and save
  try {
    const finalImage = await createComposite(screenshots);

    // Generate filename
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

    await testInfo.attach(attachmentName, { body: finalImage, contentType: 'image/png' });
  } catch (error) {
    console.error('Failed to create composite screenshot:', error);

    // Fallback: attach individual screenshots
    for (let i = 0; i < screenshots.length; i++) {
      try {
        await testInfo.attach(`Device ${i + 1}`, {
          body: screenshots[i],
          contentType: 'image/png',
        });
      } catch (attachError) {
        console.error(`Failed to attach screenshot ${i + 1}:`, attachError);
      }
    }
  }
}

// --- Logs ---

async function collectLogBuffer(
  platform: SupportedPlatformsType,
  device: DeviceWrapper,
  logCtx: LogContext
): Promise<Buffer | null> {
  if (platform === 'android') {
    const startEpochSec = (logCtx.startMs / 1000).toFixed(3);
    const parts = [
      `${getAdbFullPath()} -s ${device.udid} logcat -d -T ${startEpochSec}`,
      ...(logCtx.pid ? [`--pid=${logCtx.pid}`] : []),
    ];
    const output = await runScriptAndLog(parts.join(' '));
    return Buffer.from(output);
  }

  if (platform === 'ios') {
    const containerPath = execSync(
      `xcrun simctl get_app_container ${device.udid} ${iOSBundleId} data`,
      { encoding: 'utf8' }
    ).trim();

    const logsDir = path.join(containerPath, 'Library', 'Caches', 'Logs');

    if (!fs.existsSync(logsDir)) {
      console.log(`No logs directory found for ${device.getDeviceIdentity()}`);
      return null;
    }

    const logFiles = fs
      .readdirSync(logsDir)
      .filter(f => f.startsWith(iOSBundleId) && f.endsWith('.log'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(logsDir, f)).mtimeMs }))
      .filter(f => f.mtime >= logCtx.startMs)
      .sort((a, b) => b.mtime - a.mtime);

    if (logFiles.length === 0) {
      console.log(`No log files found after test start for ${device.getDeviceIdentity()}`);
      return null;
    }

    return Buffer.from(fs.readFileSync(path.join(logsDir, logFiles[0].name), 'utf8'));
  }

  return null;
}

const MAX_LOG_BYTES = 512 * 1024; // 512kB — tail beyond this to keep reports lean

function tailBuffer(raw: Buffer): Buffer {
  if (raw.length <= MAX_LOG_BYTES) return raw;

  const tail = raw.subarray(raw.length - MAX_LOG_BYTES);
  // Advance past any partial line at the cut point
  const firstNewline = tail.indexOf('\n'.charCodeAt(0));
  return firstNewline > 0 ? tail.subarray(firstNewline + 1) : tail;
}

export async function captureLogsOnFailure(testInfo: TestInfo): Promise<void> {
  const context = deviceRegistry.get(registryKey(testInfo));

  if (!context?.logCtxByUdid) {
    return;
  }

  await Promise.all(
    context.devices.map(async device => {
      const logCtx = context.logCtxByUdid!.get(device.udid);
      if (!logCtx) return;

      try {
        const raw = await collectLogBuffer(context.platform, device, logCtx);
        if (!raw) return;

        const buffer = tailBuffer(raw);
        const label = device.getDeviceIdentity();
        const truncated = raw.length !== buffer.length;
        await testInfo.attach(`device-log-${label}`, { body: buffer, contentType: 'text/plain' });
        console.log(
          `Log captured for ${label} (${buffer.length} bytes${truncated ? `, truncated from ${raw.length}` : ''})`
        );
      } catch (error) {
        console.error(`Failed to capture log for ${device.getDeviceIdentity()}:`, error);
      }
    })
  );
}
