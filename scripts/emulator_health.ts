import { sleepFor } from '../run/test/utils';
import { runScriptAndLog } from '../run/test/utils/utilities';

const EMULATOR_CONFIG = {
  1: 5554,
  2: 5556,
  3: 5558,
  4: 5560,
} as const;

async function getRunningEmulators(): Promise<number[]> {
  const output = await runScriptAndLog('adb devices');
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
  timeoutMs: number = 30_0000
): Promise<boolean> {
  const port = EMULATOR_CONFIG[emulatorNum as keyof typeof EMULATOR_CONFIG];
  const startTime = Date.now();
  const maxAttempts = Math.floor(timeoutMs / 5_000);

  console.log(`Waiting for emulator ${emulatorNum} to boot...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await runScriptAndLog(
        `adb -s emulator-${port} shell getprop sys.boot_completed 2>/dev/null`,
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

async function restartMissingEmulators(): Promise<void> {
  const missing = await getMissingEmulators();

  if (missing.length === 0) {
    console.log('All emulators running');
    return;
  }

  console.log(`Missing emulators: ${missing.join(', ')}`);
  console.log(`Restarting emulators: ${missing.join(', ')}`);

  for (const num of missing) {
    const port = EMULATOR_CONFIG[num as keyof typeof EMULATOR_CONFIG];

    // Kill if zombie process
    try {
      await runScriptAndLog(`adb -s emulator-${port} emu kill`, false);
      await sleepFor(2_000);
    } catch {
      // Already dead, that's fine
    }

    // Restart from snapshot (same as ci.sh start_with_snapshots)
    const configFile = `$HOME/.android/avd/emulator${num}.avd/emulator-user.ini`;
    const windowX = 100 + (num - 1) * 400;

    await runScriptAndLog(`sed -i "s/^window.x.*/window.x=${windowX}/" ${configFile}`, false);

    await runScriptAndLog(
      `DISPLAY=:0 nohup emulator @emulator${num} -gpu host -accel on -no-snapshot-save -snapshot plop.snapshot -force-snapshot-load > /dev/null 2>&1 &`,
      false
    );

    await sleepFor(5_000);
  }

  console.log(`\nWaiting for ${missing.length} emulator(s) to boot...`);

  const bootResults = await Promise.all(missing.map(num => waitForEmulatorBoot(num)));

  if (bootResults.every(result => result)) {
    console.log(`\nEmulators restarted and booted successfully`);
  } else {
    console.log(`\nSome emulators failed to boot`);
    throw new Error('Emulator recovery failed');
  }
}

const SCRIPT_TIMEOUT_MS = 5 * 60_000; // 5 minutes

async function main(): Promise<void> {
  const timeout = setTimeout(() => {
    console.error(`Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }, SCRIPT_TIMEOUT_MS);

  try {
    await restartMissingEmulators();
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
