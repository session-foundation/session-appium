import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import type { Simulator } from './create_ios_simulators';

/**
 * iOS Simulator Cleanup Script
 *
 * Deletes iOS Simulators created by create_ios_simulators.ts and cleans up configuration files.
 *
 * Environment-specific behavior:
 * - Local dev: Deletes Simulators listed in .env and removes those entries
 * - CI: Deletes Simulators listed in ios-simulators.json and removes the file
 *
 * Usage:
 *   yarn cleanup-simulators
 */

function deleteSimulator(udid: string): boolean {
  try {
    execSync(`xcrun simctl shutdown ${udid}`, { stdio: 'pipe' });
  } catch {
    // Already shutdown
  }

  try {
    execSync(`xcrun simctl delete ${udid}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function cleanupFromJSON(): number {
  const jsonPath = 'ci-simulators.json';

  // Only cleanup JSON on CI (it gets recreated there)
  // On local dev, leave it alone (it's a tracked file for CI)
  if (process.env.CI !== '1') {
    return 0;
  }

  if (!existsSync(jsonPath)) {
    return 0;
  }

  const simulators: Simulator[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  let deleted = 0;

  for (const sim of simulators) {
    if (deleteSimulator(sim.udid)) {
      deleted++;
    } else {
      console.warn(`Failed to delete: ${sim.udid}`);
    }
  }

  unlinkSync(jsonPath);
  console.log(`✓ Removed ${jsonPath}`);

  return deleted;
}

function cleanupFromEnv(): number {
  const envPath = '.env';

  if (!existsSync(envPath)) {
    return 0;
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  const udids = lines
    .filter(line => line.trim().startsWith('IOS_') && line.includes('_SIMULATOR='))
    .map(line => {
      const match = line.match(/IOS_\d+_SIMULATOR=(.+)/);
      return match ? match[1].trim() : null;
    })
    .filter((udid): udid is string => udid !== null);

  if (udids.length === 0) {
    return 0;
  }

  let deleted = 0;
  for (const udid of udids) {
    if (deleteSimulator(udid)) {
      deleted++;
    } else {
      console.warn(`Failed to delete: ${udid}`);
    }
  }

  // Remove simulator lines from .env
  const cleanedEnv =
    lines
      .filter(line => {
        const isSimLine = line.trim().startsWith('IOS_') && line.includes('_SIMULATOR=');
        const isSimComment = line.trim().startsWith('# iOS Simulators');
        return !isSimLine && !isSimComment;
      })
      .join('\n')
      .trim() + '\n';

  writeFileSync(envPath, cleanedEnv);
  console.log(`✓ Cleaned .env`);

  return deleted;
}

function cleanupIOSSimulators(): void {
  console.log('\nCleaning up iOS Simulators...\n');

  const deletedFromJSON = cleanupFromJSON();
  const deletedFromEnv = cleanupFromEnv();
  const totalDeleted = deletedFromJSON + deletedFromEnv;

  if (totalDeleted === 0) {
    console.log('No Simulators found to clean up');
  } else {
    console.log(`\n✓ Deleted ${totalDeleted} Simulator${totalDeleted !== 1 ? 's' : ''}`);
  }
}

cleanupIOSSimulators();
