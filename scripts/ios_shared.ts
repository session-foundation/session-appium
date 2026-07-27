import { exec, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { chunk } from 'lodash';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

/**
 * Boot every simulator in `udids` concurrently, returning once they have all finished booting.
 *
 * Simulators are created shut down, so without this the first test to touch a given device pays
 * the cold-boot cost inline — and it lands on the critical path at the very start of a run, when
 * every Playwright worker is booting its own pool simultaneously. Booting up front gets it out of
 * the way (and makes the cost visible as its own step rather than hiding inside the first test).
 *
 * Never throws: a simulator that fails to pre-boot is logged and left for Appium to boot on demand,
 * exactly as before. A best-effort optimisation should not be able to abort a run.
 */
export async function bootSimulatorPool(udids: string[]): Promise<void> {
  if (udids.length === 0) {
    return;
  }

  const start = Date.now();
  console.log(`Pre-booting ${udids.length} simulator(s)...`);

  await Promise.all(
    udids.map(async udid => {
      try {
        // `bootstatus -b` boots the device if it isn't already booted and only returns once the
        // boot has actually completed (unlike `simctl boot`, which returns immediately).
        await execAsync(`xcrun simctl bootstatus ${udid} -b`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  Failed to pre-boot ${udid} (Appium will boot it on demand): ${message}`);
      }
    })
  );

  console.log(`✓ Simulators ready in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

/**
 * Install `appPath` on every booted simulator in `udids`, concurrently.
 *
 * Appium installs the app as part of creating a session, but on a simulator that doesn't have it
 * yet that install lands inline in the first test to touch the device — measured at ~150s for three
 * devices, versus ~17s once they're warm. Doing it up front moves that off the critical path.
 *
 * `simctl install` is an upsert, so this is cheap (and effectively a no-op) when the app is already
 * present and unchanged. Best-effort: failures are logged and left for Appium to handle, since the
 * session-creation path installs the app anyway.
 */
export async function installAppOnSimulators(udids: string[], appPath: string): Promise<void> {
  if (udids.length === 0 || !appPath) {
    return;
  }

  const start = Date.now();
  console.log(`Pre-installing the app on ${udids.length} simulator(s)...`);

  await Promise.all(
    udids.map(async udid => {
      try {
        await execAsync(`xcrun simctl install ${udid} "${appPath}"`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  Failed to pre-install on ${udid} (Appium will install it): ${message}`);
      }
    })
  );

  console.log(`✓ App pre-installed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

/** First `wdaLocalPort`; simulator N (0-based) uses WDA_BASE_PORT + N. */
export const WDA_BASE_PORT = 1253;

export type Simulator = {
  name: string;
  udid: string;
  wdaPort: number;
};

/**
 * The simulators this run will use, from `.env` locally or `ci-simulators.json` on CI, each with
 * the `wdaLocalPort` it is addressed on.
 *
 * Lives here rather than in capabilities_ios so that global-setup can prepare these devices without
 * importing that module (which validates iOS-only env vars at load time and would therefore break
 * Android runs).
 */
export function resolveRunSimulators(): Simulator[] {
  const fromEnv: Simulator[] = [];
  for (let index = 0; index < MAX_SIMULATORS; index++) {
    const udid = getSimulatorUDID(index + 1);
    if (!udid) {
      break; // Not all 12 need to be set; stop at the first gap.
    }
    fromEnv.push({ name: `Sim-${index + 1}`, udid, wdaPort: WDA_BASE_PORT + index });
  }

  if (fromEnv.length > 0) {
    console.log(`Using ${fromEnv.length} simulators from .env file`);
    return fromEnv;
  }

  const jsonPath = 'ci-simulators.json';
  if (process.env.CI === '1') {
    if (existsSync(jsonPath)) {
      console.log('Using simulators from ci-simulators.json (CI)');
      return JSON.parse(readFileSync(jsonPath, 'utf-8')) as Simulator[];
    }
    throw new Error(`CI mode: ${jsonPath} not found`);
  }

  throw new Error(
    'No iOS simulators found in .env\n' +
      'Run: pnpm create-simulators <number>\n' +
      'Example: pnpm create-simulators 4'
  );
}

const WDA_RUNNER_BUNDLE_ID = 'com.facebook.WebDriverAgentRunner.xctrunner';

/** Is a WebDriverAgent answering on this port? */
async function isWdaResponding(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start a long-lived WebDriverAgent on each simulator and return the ports that came up.
 *
 * By default the XCUITest driver installs and launches WDA inside *every* session, and it does so
 * behind a process-wide lock (`SHARED_RESOURCES_GUARD`, keyed on the literal `'XCUITestDriver'`
 * whenever `usePreinstalledWDA` is set — see `retrieveDerivedDataPath`, which returns undefined on
 * that path, so a per-device `derivedDataPath` cannot unlock it). That serialises session startup
 * across devices at roughly 4.3s each.
 *
 * Pointing the driver at an already-running WDA via `webDriverAgentUrl` collapses its launch to a
 * single `/status` call (see `WebDriverAgent#launch`), which removes both the per-session install
 * and the serialisation. Measured at ~8s saved on a 3-device test.
 *
 * Best-effort: only ports confirmed responding are returned, and callers fall back to the driver's
 * own WDA handling for anything missing.
 */
export async function launchWdaOnSimulators(
  entries: Array<{ udid: string; port: number }>,
  wdaAppPath: string
): Promise<number[]> {
  if (entries.length === 0 || !wdaAppPath) {
    return [];
  }

  const start = Date.now();
  console.log(`Starting WebDriverAgent on ${entries.length} simulator(s)...`);

  const launched = await Promise.all(
    entries.map(async ({ udid, port }) => {
      try {
        if (await isWdaResponding(port)) {
          return port; // Left running by an earlier run — reuse it as-is.
        }
        await execAsync(`xcrun simctl install ${udid} "${wdaAppPath}"`);
        // Mirrors what the driver itself does (WebDriverAgent#launchWithPreinstalledWDA): simctl
        // passes SIMCTL_CHILD_-prefixed vars through to the launched process.
        await execAsync(
          `SIMCTL_CHILD_USE_PORT=${port} ` +
            `SIMCTL_CHILD_WDA_PRODUCT_BUNDLE_IDENTIFIER=${WDA_RUNNER_BUNDLE_ID} ` +
            `xcrun simctl launch --terminate-running-process ${udid} ${WDA_RUNNER_BUNDLE_ID}`
        );

        // WDA binds its port a moment after the process starts, so poll rather than assume.
        for (let attempt = 0; attempt < 30; attempt++) {
          if (await isWdaResponding(port)) {
            return port;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.warn(`  WDA on ${udid} (port ${port}) did not come up; falling back for it`);
        return null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`  Failed to start WDA on ${udid}: ${message}`);
        return null;
      }
    })
  );

  const ports = launched.filter((port): port is number => port !== null);
  console.log(
    `✓ WebDriverAgent ready on ${ports.length}/${entries.length} simulator(s) in ` +
      `${((Date.now() - start) / 1000).toFixed(1)}s`
  );
  return ports;
}

/** UDIDs of the configured IOS_N_SIMULATOR entries, in order, stopping at the first unset one. */
export function getConfiguredSimulatorUDIDs(max: number = MAX_SIMULATORS): string[] {
  const udids: string[] = [];
  for (let index = 1; index <= max; index++) {
    const udid = getSimulatorUDID(index);
    if (!udid) {
      break;
    }
    udids.push(udid);
  }
  return udids;
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
