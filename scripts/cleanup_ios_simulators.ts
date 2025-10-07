import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

import type { Simulator } from '../run/test/specs/utils/capabilities_ios';

import { shutdownSimulator } from './ios_shared';

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
function deleteSimulator(udids: string[] | string): number {
  const udidArray = Array.isArray(udids) ? udids : [udids];
  let deleted = 0;

  for (const udid of udidArray) {
    shutdownSimulator(udid);
    try {
      execSync(`xcrun simctl delete ${udid}`, { stdio: 'pipe' });
      deleted++;
    } catch {
      console.warn(`Failed to delete: ${udid}`);
    }
  }

  return deleted;
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
  const deleted = deleteSimulator(simulators.map(sim => sim.udid));

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

  const simulatorPattern = /^IOS_\d+_SIMULATOR=/;
  const simulatorExtractPattern = /^IOS_\d+_SIMULATOR=(.+)/;

  const udids = lines
    .map(line => {
      const match = line.match(simulatorExtractPattern);
      return match ? match[1].trim() : null;
    })
    .filter((udid): udid is string => udid !== null);

  if (udids.length === 0) {
    return 0;
  }

  const deleted = deleteSimulator(udids);

  // Remove simulator lines from .env
  const cleanedEnv =
    lines
      .filter(line => !simulatorPattern.test(line.trim()))
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
