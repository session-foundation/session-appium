import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

import type { Simulator } from '../run/test/utils/capabilities_ios';
import type { DeviceWrapper } from '../run/types/DeviceWrapper';

import { copyFileToSimulator } from '../run/test/utils/copy_file_to_simulator';
import {
  bootSimulator,
  isSimulatorBooted,
  resolveIosRuntime,
  shutdownSimulator,
} from './ios_shared';
import { sleepSync } from './shared';

/**
 * iOS Simulator Creation Script
 *
 * Creates iOS Simulators with preloaded media (images, videos, PDFs) using a clone-based approach:
 * 1. Creates one "template" Simulator (Simulator 0)
 * 2. Boots it, loads media, then shuts it down
 * 3. Clones it N-1 times to create remaining Simulators
 *
 * Note: You can't add media to shutdown Simulators and you can't clone booted Simulators,
 * which is why we boot -> load -> shutdown -> clone.
 *
 * Environment-specific behavior:
 * - Local dev: Updates .env with IOS_N_SIMULATOR variables
 * - CI: Creates ios-simulators.json for persistent Simulator tracking
 *
 * Usage:
 *   pnpm create-simulators 4   # Local: 4 Simulators
 *   CI=1 pnpm create-simulators 12  # For CI: 12 Simulators
 */

type SimulatorConfig = {
  deviceType: string;
  runtime: string;
  name: string;
  totalSimulators: number;
};

// Default device type + runtime. The runtime is a *preference*: if it isn't installed we fall
// back to the newest installed iOS runtime (see resolveDeviceConfig). Both can be overridden via
// the IOS_SIM_DEVICE_TYPE / IOS_SIM_RUNTIME env vars (or `--runtime` on run_ios_parallel).
const DEVICE_CONFIG_DEFAULTS = {
  type: 'iPhone 17',
  runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-26-2', // xcrun simctl list runtimes
};

/**
 * Resolve the device type + runtime to create simulators against, applying overrides and
 * falling back to the newest installed iOS runtime when the preferred one is missing.
 *
 * @param overrides.runtime a friendly version ("26.1") or full runtime identifier
 * @param overrides.deviceType e.g. "iPhone 16e"
 */
export function resolveDeviceConfig(overrides?: { runtime?: string; deviceType?: string }): {
  deviceType: string;
  runtime: string;
  name: string;
} {
  const deviceType =
    overrides?.deviceType ?? process.env.IOS_SIM_DEVICE_TYPE ?? DEVICE_CONFIG_DEFAULTS.type;
  const runtimeOverride = overrides?.runtime ?? process.env.IOS_SIM_RUNTIME;
  const runtime = resolveIosRuntime(DEVICE_CONFIG_DEFAULTS.runtime, runtimeOverride);
  // `name` is only a cosmetic prefix for the simulator name (e.g. "Auto-17-0").
  const name = deviceType.replace(/^iPhone\s*/i, '').trim() || deviceType;
  return { deviceType, runtime: runtime.identifier, name };
}

const MEDIA_ROOT = path.join('run', 'test', 'media');
const MEDIA_FILES = {
  images: ['profile_picture.jpg', 'test_image.jpg', 'animated_profile_picture.gif'],
  videos: ['test_video.mp4'],
  pdfs: ['test_file.pdf'],
};

function createSimulator(name: string, deviceType: string, runtime: string): string {
  const output = execSync(`xcrun simctl create "${name}" "${deviceType}" "${runtime}"`, {
    encoding: 'utf-8',
  }).trim();
  return output;
}

function cloneSimulator(sourceUdid: string, newName: string): string {
  const output = execSync(`xcrun simctl clone ${sourceUdid} "${newName}"`, {
    encoding: 'utf-8',
  }).trim();
  return output;
}

function waitForBoot(udid: string): boolean {
  sleepSync(2);
  for (let i = 0; i < 30; i++) {
    if (isSimulatorBooted(udid)) {
      return true;
    }
    sleepSync(1);
  }
  return false;
}

function preloadMedia(udid: string): void {
  // Add images and videos
  const mediaFiles = [...MEDIA_FILES.images, ...MEDIA_FILES.videos];
  for (const filename of mediaFiles) {
    const mediaPath = path.join(MEDIA_ROOT, filename);
    if (!existsSync(mediaPath)) {
      throw new Error(`Media file not found: ${filename}`);
    }
    execSync(`xcrun simctl addmedia ${udid} "${mediaPath}"`);
  }

  // Copy PDFs to Files app Downloads folder
  // copyFileToSimulator expects a DeviceWrapper with udid and log properties
  // We create a minimal mock object since we're not in a test context
  const mockDevice: Pick<DeviceWrapper, 'log' | 'udid'> = {
    udid,
    log: () => {}, // Empty function (no need for logs during setup)
  };

  for (const filename of MEDIA_FILES.pdfs) {
    const sourcePath = path.join(MEDIA_ROOT, filename);
    if (!existsSync(sourcePath)) {
      throw new Error(`PDF file not found: ${filename}`);
    }
    copyFileToSimulator(mockDevice as DeviceWrapper, filename);
  }
}

// Create N number of pre-loaded simulators by:
// Creating one "template" simulator, booting it, copying media over, shutting it down and then cloning it N-1 times
// (You can't copy to shutdown simulators and you can't clone booted simulators)
//
// NOTE: this only creates the simulators and returns them (all left shut down — Appium boots
// them on demand). Persisting the config (.env / ci-simulators.json) is the caller's job, so
// that callers which manage their own simulator lifecycle (e.g. run_ios_parallel.ts) can create
// throwaway simulators without clobbering the developer's .env.
export function createIOSSimulators(config: SimulatorConfig): Simulator[] {
  console.log(`\nCreating ${config.totalSimulators} iOS simulators\n`);

  const startTime = Date.now();
  const simulators: Simulator[] = [];

  // Create Simulator 0 with preloaded media
  console.log(`Creating Simulator 0 with preloaded media...`);

  const name0 = `Auto-${config.name}-0`;
  const udid0 = createSimulator(name0, config.deviceType, config.runtime);

  if (!bootSimulator(udid0)) {
    throw new Error('Failed to boot Simulator 0');
  }

  if (!waitForBoot(udid0)) {
    throw new Error('Simulator 0 boot timeout');
  }

  preloadMedia(udid0);
  shutdownSimulator(udid0);

  simulators.push({
    name: name0,
    udid: udid0,
    wdaPort: 1253,
  });

  console.log(`✓ ${name0} ready`);

  // Clone remaining simulators from Simulator 0
  console.log(`Cloning ${config.totalSimulators - 1} more Simulators...`);

  for (let index = 1; index < config.totalSimulators; index++) {
    const name = `Auto-${config.name}-${index}`;
    const udid = cloneSimulator(udid0, name);

    simulators.push({
      name,
      udid,
      wdaPort: 1253 + index,
    });

    console.log(`  [${index}/${config.totalSimulators - 1}] ${name}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Created ${simulators.length} Simulators in ${totalTime}s`);

  return simulators;
}

export function updateLocalEnvFile(simulators: Simulator[]): void {
  const envPath = '.env';
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  // Remove old simulator lines
  const simulatorPattern = /^IOS_\d+_SIMULATOR=/;
  envContent = envContent
    .split('\n')
    .filter(line => !simulatorPattern.test(line.trim()))
    .join('\n');

  // Add new simulator UDIDs
  const simLines = simulators.map((sim, i) => `IOS_${i + 1}_SIMULATOR=${sim.udid}`).join('\n');

  envContent = envContent.trim() + '\n\n# iOS Simulators (auto-generated)\n' + simLines + '\n';
  writeFileSync(envPath, envContent);
}

export function saveSimulatorConfig(simulators: Simulator[]): void {
  // For running on CI, create a json file that GHA can read the UDIDs from
  if (process.env.CI === '1') {
    writeFileSync('ci-simulators.json', JSON.stringify(simulators, null, 2));
    console.log(`✓ Saved to ci-simulators.json`);
  } else {
    // For local development, update the IOS_N_SIMULATOR variables in .env
    updateLocalEnvFile(simulators);
    console.log(`✓ Updated .env`);
  }
}

// Main execution (only when invoked directly, e.g. `pnpm create-simulators`).
// When imported as a module (e.g. by run_ios_parallel.ts) this block does not run.
if (require.main === module) {
  const numSimulatorsArg = process.argv[2];

  if (!numSimulatorsArg) {
    console.error('Error: Number of Simulators required');
    console.error('Usage: pnpm create-simulators <number>');
    process.exit(1);
  }

  const numSimulators = parseInt(numSimulatorsArg);

  if (isNaN(numSimulators) || numSimulators < 1) {
    console.error('Error: Invalid number of Simulators');
    console.error('Usage: pnpm create-simulators <number>');
    process.exit(1);
  }

  try {
    const deviceConfig = resolveDeviceConfig();
    const sims = createIOSSimulators({ ...deviceConfig, totalSimulators: numSimulators });
    saveSimulatorConfig(sims);
  } catch (error) {
    console.error('\n✗ Failed to create Simulators');
    console.error(error);
    process.exit(1);
  }
}
