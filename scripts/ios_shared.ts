import { execSync } from 'child_process';
import { chunk } from 'lodash';

export type IosRuntime = { identifier: string; version: string };

type SimctlRuntimeEntry = {
  identifier: string;
  version: string;
  isAvailable?: boolean;
};

/** Compare two dotted version strings numerically (e.g. "26.1" > "18.6"). */
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n) || 0);
  const pb = b.split('.').map(n => parseInt(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** All installed, available iOS simulator runtimes, newest first. */
export function listAvailableIosRuntimes(): IosRuntime[] {
  const raw = execSync('xcrun simctl list runtimes --json', { encoding: 'utf-8' });
  const parsed = JSON.parse(raw) as { runtimes: SimctlRuntimeEntry[] };
  return parsed.runtimes
    .filter(r => r.isAvailable !== false && r.identifier.includes('SimRuntime.iOS-'))
    .map(r => ({ identifier: r.identifier, version: r.version }))
    .sort((a, b) => compareVersionsDesc(a.version, b.version));
}

/** Turn a friendly override ("26.1") or a full identifier into a runtime identifier. */
function normaliseRuntimeOverride(override: string): string {
  const trimmed = override.trim();
  if (trimmed.startsWith('com.apple')) {
    return trimmed;
  }
  return `com.apple.CoreSimulator.SimRuntime.iOS-${trimmed.replace(/\./g, '-')}`;
}

/**
 * Resolve which iOS runtime to create simulators against.
 * - `override` (a version like "26.1" or a full identifier) must be installed, else we throw
 *   with the list of what IS installed.
 * - Otherwise we use `preferredIdentifier` if installed, and fall back to the newest installed
 *   iOS runtime if not (logging a notice). This keeps things working when Apple bumps versions.
 */
export function resolveIosRuntime(preferredIdentifier: string, override?: string): IosRuntime {
  const available = listAvailableIosRuntimes();
  if (available.length === 0) {
    throw new Error(
      'No iOS simulator runtimes are installed. Install one via Xcode > Settings > Components.'
    );
  }

  if (override) {
    const wanted = normaliseRuntimeOverride(override);
    const match = available.find(r => r.identifier === wanted);
    if (!match) {
      throw new Error(
        `Requested iOS runtime "${override}" (${wanted}) is not installed.\n` +
          `Available iOS runtimes: ${available.map(r => r.version).join(', ')}`
      );
    }
    return match;
  }

  const preferred = available.find(r => r.identifier === preferredIdentifier);
  if (preferred) {
    return preferred;
  }

  const newest = available[0];
  console.warn(
    `Preferred iOS runtime (${preferredIdentifier}) is not installed; falling back to the ` +
      `newest available: iOS ${newest.version}. Set IOS_SIM_RUNTIME=<version> (or pass ` +
      `--runtime) to choose a specific one.`
  );
  return newest;
}

export function getSimulatorUDID(index: number) {
  const envVar = `IOS_${index}_SIMULATOR`;
  return process.env[envVar];
}

export function bootSimulator(udid: string, label?: number | string): boolean {
  try {
    if (label !== undefined) {
      console.log(`Booting simulator ${label}: ${udid}`);
    }
    execSync(`xcrun simctl boot ${udid}`, { stdio: 'pipe' });
    return true;
  } catch (error: any) {
    if (error.message?.includes('Unable to boot device in current state: Booted')) {
      if (label !== undefined) {
        console.log(`Simulator ${label} already booted: ${udid}`);
      }
      return true;
    }

    console.error(`Failed to boot simulator ${label || udid}`);
    console.error(error.stderr?.toString() || error.message);
    return false;
  }
}

export function isSimulatorBooted(udid: string) {
  try {
    const result = execSync(`xcrun simctl list devices booted`).toString();
    return result.includes(udid);
  } catch (error: any) {
    console.error('Error checking booted devices', error.message);
    return false;
  }
}

export function isAnySimulatorBooted() {
  try {
    const result = execSync(`xcrun simctl list devices booted`).toString();
    return result.includes('Booted');
  } catch (error: any) {
    console.error('Error checking booted devices', error.message);
    return false;
  }
}

const MAX_SIMULATORS = 12;

export function getAllSimulators() {
  const simulators = [];
  for (let index = 1; index <= MAX_SIMULATORS; index++) {
    const udid = getSimulatorUDID(index);
    if (!udid) {
      throw new Error(`Error: Simulator ${index} (IOS_${index}_SIMULATOR) is not set`);
    }
    simulators.push({ index, udid });
  }
  return simulators;
}

export function getChunkedSimulators(chunkSize: number) {
  return chunk(getAllSimulators(), chunkSize);
}

export function shutdownSimulator(udid: string): void {
  try {
    execSync(`xcrun simctl shutdown ${udid}`, { stdio: 'pipe' });
  } catch {
    // Already shutdown or doesn't exist - this is fine
  }
}

/**
 * Shut down (if needed) and delete the given simulator UDIDs. Returns the number successfully
 * deleted. Never throws — a simulator that is already gone is treated as success-adjacent and
 * simply skipped, so this is safe to call from cleanup/signal handlers.
 */
export function deleteSimulators(udids: string[] | string): number {
  const udidArray = Array.isArray(udids) ? udids : [udids];
  let deleted = 0;

  for (const udid of udidArray) {
    shutdownSimulator(udid);
    try {
      execSync(`xcrun simctl delete ${udid}`, { stdio: 'pipe' });
      deleted++;
    } catch {
      console.warn(`Failed to delete simulator: ${udid}`);
    }
  }

  return deleted;
}
