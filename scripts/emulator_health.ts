import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { sleepFor } from '../run/test/utils';
import { getAdbFullPath, getEmulatorFullPath } from '../run/test/utils/binaries';
import { runScriptAndLog } from '../run/test/utils/utilities';

// These must match create_android_emulators.ts, which creates the AVDs and owns the naming:
// `${AVD_PREFIX}_${n}`, with its snapshot saved as `qa.snapshot`. An AVD name that does not exist
// makes every recovery a no-op, and the emulator says so only on stderr.
const AVD_PREFIX = 'Session_QA';
const SNAPSHOT_NAME = 'qa.snapshot';

function avdNameFor(emulatorNum: number): string {
  return `${AVD_PREFIX}_${emulatorNum}`;
}

const EMULATOR_CONFIG = {
  1: 5554,
  2: 5556,
  3: 5558,
  4: 5560,
} as const;

async function getRunningEmulators(): Promise<number[]> {
  const output = await runScriptAndLog(`${getAdbFullPath()} devices`);
  return output
    .split('\n')
    .map(line => {
      // Match only lines with emulator-PORT followed by 'device' state
      const match = line.match(/emulator-(\d+)\s+device$/);
      return match ? parseInt(match[1]) : null;
    })
    .filter((port): port is number => port !== null);
}

function portToEmulatorNum(port: number): number | undefined {
  const entry = Object.entries(EMULATOR_CONFIG).find(([_, p]) => p === port);
  return entry ? parseInt(entry[0]) : undefined;
}

async function getMissingEmulators(): Promise<number[]> {
  const running = await getRunningEmulators();
  const allNums = Object.keys(EMULATOR_CONFIG).map(Number);
  const runningNums = running.map(portToEmulatorNum).filter((n): n is number => n !== undefined);
  return allNums.filter(n => !runningNums.includes(n));
}

async function waitForEmulatorBoot(
  emulatorNum: number,
  timeoutMs: number = 300_000
): Promise<boolean> {
  const port = EMULATOR_CONFIG[emulatorNum as keyof typeof EMULATOR_CONFIG];
  const udid = `emulator-${port}`;
  const startTime = Date.now();
  const maxAttempts = Math.floor(timeoutMs / 5_000);

  console.log(`Waiting for emulator ${emulatorNum} to boot...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await runScriptAndLog(
        `${getAdbFullPath()} -s ${udid} shell getprop sys.boot_completed 2>/dev/null`,
        false
      );

      if (result.trim() === '1') {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`Emulator ${emulatorNum} booted (${elapsed}s)`);
        return true;
      }
    } catch {
      // Emulator not ready yet
    }

    await sleepFor(5_000);
  }

  console.log(`Emulator ${emulatorNum} failed to boot within ${timeoutMs / 1000}s`);
  return false;
}

export async function recoverEmulator(emulatorNum: number): Promise<void> {
  const port = EMULATOR_CONFIG[emulatorNum as keyof typeof EMULATOR_CONFIG];
  const udid = `emulator-${port}`;
  const avdName = avdNameFor(emulatorNum);

  console.warn(`[Recovery] recovering ${udid} (${avdName})...`);

  // Kill whatever is on this port first. An emulator that still answers adb can be sick in ways
  // that only a restart clears -- one stopped expiring disappearing messages while reporting
  // `device`, which read as a product bug across nine specs -- so recovery must not assume the
  // slot is empty.
  try {
    await runScriptAndLog(`${getAdbFullPath()} -s ${udid} emu kill`, false);
    await sleepFor(2_000);
  } catch {
    // Already dead, that's fine
  }

  // A snapshot is only present where one was saved (CI). Forcing a load without it fails, and the
  // failure is invisible below, so cold boot instead.
  const snapshotDir = join(
    homedir(),
    '.android',
    'avd',
    `${avdName}.avd`,
    'snapshots',
    SNAPSHOT_NAME
  );
  const snapshotArgs = existsSync(snapshotDir)
    ? `-no-snapshot-save -snapshot ${SNAPSHOT_NAME} -force-snapshot-load`
    : '-no-snapshot-load';

  // Mirrors `bootAvd` in create_android_emulators.ts, which owns these conventions:
  //  - `-port` is required. Without it the emulator takes the next free port rather than the one
  //    the suite addresses by udid (capabilities_android.ts hardcodes 5554/5556/5558/5560).
  //  - the env assignment goes BEFORE `nohup`; only the shell expands `VAR=value cmd`.
  //  - stdout goes to a file, not /dev/null. A launch that fails -- a wrong AVD name, a missing
  //    snapshot -- says so on stderr, and discarding it turns "no emulator" into a boot wait that
  //    runs to its full timeout with nothing to show for it.
  const display = process.platform === 'linux' ? 'DISPLAY=:0 ' : '';
  await runScriptAndLog(
    `${display}nohup "${getEmulatorFullPath()}" @${avdName} -port ${port} ${snapshotArgs} ` +
      `-no-boot-anim > /tmp/emulator-${port}.log 2>&1 &`,
    false
  );

  const booted = await waitForEmulatorBoot(emulatorNum);
  if (!booted) {
    throw new Error(
      `[Recovery] ${udid} failed to boot -- see /tmp/emulator-${port}.log for the emulator's own error`
    );
  }
}

/**
 * `force` recycles every configured emulator rather than only the absent ones.
 *
 * Presence is a weak health signal: an emulator can answer adb, report `device` and drive Appium
 * while a subsystem inside it has stopped. One in that state failed to expire a single disappearing
 * message across nine specs while the other two in the same runs expired every one, which presented
 * as a reproducible product bug correlated with message type. Nothing short of a restart clears it,
 * and nothing this script can probe distinguishes it, so recycling has to be available on demand.
 */
async function restartEmulators(force: boolean): Promise<void> {
  const targets = force ? Object.keys(EMULATOR_CONFIG).map(Number) : await getMissingEmulators();

  if (targets.length === 0) {
    console.log('All emulators running');
    return;
  }

  console.log(
    force
      ? `Recycling all emulators: ${targets.join(', ')}...`
      : `Missing emulators: ${targets.join(', ')} — recovering...`
  );

  const results = await Promise.allSettled(targets.map(num => recoverEmulator(num)));
  if (results.some(r => r.status === 'rejected')) {
    throw new Error('Emulator recovery failed');
  }
}

// A cold boot of the whole fleet does not fit in five minutes: waitForEmulatorBoot alone allows
// 300s per emulator, so the old budget could fire while a perfectly healthy boot was in progress.
const SCRIPT_TIMEOUT_MS = 15 * 60_000;

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error(`Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }, SCRIPT_TIMEOUT_MS);

  try {
    await restartEmulators(process.argv.includes('--force'));
    process.exit(0);
  } catch (error) {
    console.error('Recovery failed:', error);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

if (require.main === module) {
  void main();
}
