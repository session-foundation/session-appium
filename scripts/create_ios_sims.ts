import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

import type { DeviceWrapper } from '../run/types/DeviceWrapper';

import { copyFileToSimulator } from '../run/test/specs/utils/copy_file_to_simulator';
import { isSimulatorBooted } from './ios_shared';
import { sleepSync } from './shared';

interface SimulatorConfig {
  deviceType: string;
  runtime: string;
  totalSimulators: number;
}

interface Simulator {
  name: string;
  udid: string;
  wdaPort: number;
  index: number;
}

const MEDIA_ROOT = path.join('run', 'test', 'specs', 'media');

const MEDIA_FILES = {
  images: ['profile_picture.jpg', 'test_image.jpg'],
  videos: ['test_video.mp4'],
  pdfs: ['test_file.pdf'],
};

function createSimulator(name: string, deviceType: string, runtime: string): string {
  console.log(`Creating simulator: ${name}`);

  const output = execSync(`xcrun simctl create "${name}" "${deviceType}" "${runtime}"`, {
    encoding: 'utf-8',
  }).trim();

  console.log(`  Created with UDID: ${output}`);
  return output;
}

function cloneSimulator(sourceUdid: string, newName: string): string {
  console.log(`Cloning simulator: ${newName}`);

  const output = execSync(`xcrun simctl clone ${sourceUdid} "${newName}"`, {
    encoding: 'utf-8',
  }).trim();

  console.log(`  Cloned with UDID: ${output}`);
  return output;
}

function bootSimulator(udid: string, index: number): boolean {
  try {
    console.log(`Booting simulator ${index}: ${udid}`);
    execSync(`xcrun simctl boot ${udid}`, { stdio: 'inherit' });
  } catch (error: any) {
    if (error.message?.includes('Unable to boot device in current state: Booted')) {
      console.log(`  Simulator already booted`);
      return true;
    }
    console.error(`Error: Boot command failed for ${udid}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }

  return true;
}

function shutdownSimulator(udid: string): void {
  console.log('Shutting down simulator...');
  try {
    execSync(`xcrun simctl shutdown ${udid}`, { stdio: 'pipe' });
    console.log('  ✓ Shutdown complete');
  } catch (error) {
    console.warn('  ⚠ Warning: Failed to shutdown (may already be shutdown)');
  }
}

function waitForBoot(udid: string): boolean {
  console.log(`  Waiting for boot to complete...`);

  sleepSync(2);

  for (let i = 0; i < 30; i++) {
    if (isSimulatorBooted(udid)) {
      console.log(`  ✓ Boot complete`);
      return true;
    }
    sleepSync(1);
  }

  console.error(`  ✗ Simulator did not boot within 30 seconds`);
  return false;
}

function preloadImagesAndVideos(udid: string): void {
  console.log(`Preloading images and videos...`);

  const allMediaFiles = [...MEDIA_FILES.images, ...MEDIA_FILES.videos];

  for (const filename of allMediaFiles) {
    const mediaPath = path.join(MEDIA_ROOT, filename);

    if (!existsSync(mediaPath)) {
      console.warn(`  ⚠ Warning: Media file not found: ${mediaPath}`);
      continue;
    }

    try {
      execSync(`xcrun simctl addmedia ${udid} "${mediaPath}"`, { stdio: 'pipe' });
      console.log(`  ✓ Added ${filename}`);
    } catch (error) {
      console.error(`  ✗ Failed to add ${filename}:`, error);
      throw error;
    }
  }
}

function preloadPDFs(udid: string): void {
  console.log(`Preloading PDFs...`);

  const mockDevice: Pick<DeviceWrapper, 'log' | 'udid'> = {
    udid,
    log: (message: string) => console.log(`  ${message}`),
  };

  for (const filename of MEDIA_FILES.pdfs) {
    const sourcePath = path.join(MEDIA_ROOT, filename);

    if (!existsSync(sourcePath)) {
      console.warn(`  ⚠ Warning: PDF file not found: ${sourcePath}`);
      continue;
    }

    try {
      copyFileToSimulator(mockDevice as DeviceWrapper, filename);
      console.log(`  ✓ Copied ${filename} to Downloads`);
    } catch (error) {
      console.error(`  ✗ Failed to copy ${filename}:`, error);
      throw error;
    }
  }
}

function createMasterSimulatorWithMedia(config: SimulatorConfig): string {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Creating master simulator with preloaded media');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const masterName = `Automation-Master-${Date.now()}`;
  const masterUdid = createSimulator(masterName, config.deviceType, config.runtime);

  const bootSuccess = bootSimulator(masterUdid, 0);
  if (!bootSuccess) {
    throw new Error('Failed to boot master simulator');
  }

  const bootComplete = waitForBoot(masterUdid);
  if (!bootComplete) {
    throw new Error('Master simulator did not boot in time');
  }

  preloadImagesAndVideos(masterUdid);
  preloadPDFs(masterUdid);

  shutdownSimulator(masterUdid);

  console.log(`✓ Master simulator ready: ${masterName} (${masterUdid})\n`);

  return masterUdid;
}

function updateLocalEnvFile(simulators: Simulator[]): void {
  const envPath = '.env';
  let envContent = '';

  // Read existing .env if it exists
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8');

    // Remove old IOS_X_SIMULATOR lines
    envContent = envContent
      .split('\n')
      .filter(line => {
        const isSimLine = line.trim().startsWith('IOS_') && line.includes('_SIMULATOR=');
        return !isSimLine;
      })
      .join('\n');
  }

  // Add new simulator UDIDs
  const simLines = simulators.map((sim, i) => `IOS_${i + 1}_SIMULATOR=${sim.udid}`).join('\n');

  envContent = envContent.trim() + '\n\n# iOS Simulators (auto-generated)\n' + simLines + '\n';

  writeFileSync(envPath, envContent);
  console.log(`✓ Updated .env with ${simulators.length} simulator UDIDs`);
}

function saveSimulatorConfig(simulators: Simulator[]): void {
  if (process.env.CI) {
    // CI: Save to persistent JSON file
    console.log('\n📝 CI environment detected - saving to ios-simulators.json');
    const outputPath = 'ios-simulators.json';
    writeFileSync(outputPath, JSON.stringify(simulators, null, 2));
    console.log(`✓ Configuration saved to ${outputPath} (persistent)`);
  } else {
    // Local: Update .env file
    console.log('\n📝 Local environment detected - updating .env file');
    updateLocalEnvFile(simulators);
  }
}

function createIOSSimulators(config: SimulatorConfig) {
  const startTime = Date.now();
  const simulators: Simulator[] = [];

  console.log('\n========================================');
  console.log('iOS Simulator Setup - Clone Method');
  console.log('========================================');
  console.log(`Creating ${config.totalSimulators} iOS simulators`);
  console.log(`  Device type: ${config.deviceType}`);
  console.log(`  Runtime: ${config.runtime}`);
  console.log(`  Strategy: Create 1 master + clone ${config.totalSimulators - 1} times`);
  console.log('========================================\n');

  // Verify media files
  console.log('Verifying media files...');
  const allFiles = [...MEDIA_FILES.images, ...MEDIA_FILES.videos, ...MEDIA_FILES.pdfs];
  let missingFiles = 0;

  for (const filename of allFiles) {
    const mediaPath = path.join(MEDIA_ROOT, filename);
    if (existsSync(mediaPath)) {
      console.log(`  ✓ ${filename}`);
    } else {
      console.error(`  ✗ ${filename} - NOT FOUND at ${mediaPath}`);
      missingFiles++;
    }
  }

  if (missingFiles > 0) {
    console.warn(`\n⚠ Warning: ${missingFiles} media file(s) missing`);
    console.log('Continuing anyway... (will skip missing files)\n');
  } else {
    console.log('\n✓ All media files verified\n');
  }

  const setupStartTime = Date.now();

  // Step 1: Create master simulator with all media
  const masterUdid = createMasterSimulatorWithMedia(config);

  const masterCompleteTime = Date.now();
  console.log(
    `⏱️  Master creation time: ${((masterCompleteTime - setupStartTime) / 1000).toFixed(2)}s\n`
  );

  // Step 2: Clone the master for all needed simulators
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Cloning master simulator ${config.totalSimulators} times`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cloneStartTime = Date.now();

  for (let index = 0; index < config.totalSimulators; index++) {
    console.log(`[${index + 1}/${config.totalSimulators}] Simulator ${index}`);

    const timestamp = Date.now();
    const name = `Automation-${index}-${timestamp}`;
    const udid = cloneSimulator(masterUdid, name);

    simulators.push({
      name,
      udid,
      wdaPort: 1253 + index,
      index,
    });

    console.log(`✓ Cloned: ${name} (${udid})\n`);
  }

  const cloneCompleteTime = Date.now();
  console.log(`⏱️  Cloning time: ${((cloneCompleteTime - cloneStartTime) / 1000).toFixed(2)}s\n`);

  // Step 3: Delete the master simulator
  console.log('Cleaning up master simulator...');
  try {
    execSync(`xcrun simctl delete ${masterUdid}`, { stdio: 'pipe' });
    console.log(`✓ Master simulator deleted\n`);
  } catch (error) {
    console.warn(`⚠ Warning: Failed to delete master simulator ${masterUdid}`);
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  console.log('========================================');
  console.log(`✓ All ${simulators.length} simulators created`);
  console.log(`⏱️  TOTAL TIME: ${totalTime}s`);
  console.log('========================================\n');

  console.log('Summary:');
  simulators.forEach(sim => {
    console.log(`  [${sim.index}] ${sim.name} - ${sim.udid}`);
  });
  console.log('');

  // Save configuration based on environment
  saveSimulatorConfig(simulators);

  return simulators;
}

// Main execution
// Support both env var and command line arg
const numSimulatorsArg = process.argv[2];
const numSimulators = numSimulatorsArg
  ? parseInt(numSimulatorsArg)
  : parseInt(process.env.NUM_SIMULATORS || '12');

if (isNaN(numSimulators) || numSimulators < 1) {
  console.error('❌ Invalid number of simulators');
  console.error('Usage: yarn create-simulators <number>');
  process.exit(1);
}

try {
  createIOSSimulators({
    deviceType: 'iPhone 16 Pro Max',
    runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-18-3',
    totalSimulators: numSimulators,
  });
} catch (error) {
  console.error('\n❌ Failed to create iOS simulators');
  console.error(error);
  process.exit(1);
}
