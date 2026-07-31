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
 * How many simulators are prepared at once.
 *
 * Bounded rather than all-at-once because per-simulator cost depends heavily on how many are being
 * prepared alongside it. Measured on the CI runner, cold-booting the 12-simulator pool:
 *
 * | width |  total | per sim |
 * |-------|--------|---------|
 * |     1 | 128.4s |   10.7s |
 * |     2 |  71.8s |    6.0s |
 * |     3 |  58.8s |    4.9s |
 * |     4 |  57.4s |    4.8s |
 * |     6 |  82.4s |    6.9s |
 * |    12 |  76.6s |    6.4s |
 *
 * Three rather than the nominally-fastest four: they are 1.4s apart on a single run, well inside the
 * run-to-run variance, so the choice is really between two tied options. The curve is asymmetric — 2
 * costs 1.25x while 6 costs 1.43x — and the optimum shifts *down* as the host gets busier, so the
 * lower of the two tied widths stays near-optimal when something else is running on the runner while
 * the higher one drifts toward the steep side.
 *
 * Note this bounds the preparation, not the resulting load: a booted simulator holds its processes
 * (~230 of them, measured) for as long as it stays booted, and the run needs the whole pool booted at
 * once regardless.
 */
const DEFAULT_PREPARE_CONCURRENCY = 3;

/** Ceiling for a single `simctl bootstatus` call — see the call site for why it needs one at all. */
const BOOT_TIMEOUT_MS = 180_000;

/** How long to wait for a freshly launched WDA to bind its port: 60 x 500ms = 30s. */
const WDA_PORT_POLL_ATTEMPTS = 60;
const WDA_PORT_POLL_INTERVAL_MS = 500;

/**
 * How many simulators to prepare at once, from IOS_BOOT_CONCURRENCY.
 *
 * Configurable because the answer is host-dependent — a faster runner tolerates more concurrency — so
 * the width can be re-measured on the machine in question rather than inheriting a number derived from
 * a different one. Capped at the pool size, since a wider setting than there are simulators is just
 * the pool size.
 */
function prepareConcurrency(poolSize: number): number {
  const configured = process.env.IOS_BOOT_CONCURRENCY?.trim();
  if (!configured) {
    return Math.min(DEFAULT_PREPARE_CONCURRENCY, poolSize);
  }

  const width = Number(configured);
  if (!Number.isInteger(width) || width < 1) {
    console.warn(
      `Ignoring IOS_BOOT_CONCURRENCY="${configured}" (expected a positive integer); ` +
        `using ${DEFAULT_PREPARE_CONCURRENCY} at a time.`
    );
    return Math.min(DEFAULT_PREPARE_CONCURRENCY, poolSize);
  }
  return Math.min(width, poolSize);
}

/**
 * Run `task` over `items`, at most `width` at a time, keeping results in input order.
 *
 * A shared queue drained by `width` workers rather than fixed batches: a batch only finishes when its
 * slowest member does, leaving capacity idle at the tail of every batch. Taking the next item as soon
 * as a worker frees up keeps `width` in flight throughout.
 *
 * The index counter needs no locking — workers only interleave at their `await`, and it is read and
 * incremented synchronously before that.
 */
async function withConcurrency<T, R>(
  items: Array<T>,
  width: number,
  task: (item: T) => Promise<R>
): Promise<Array<R>> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(width, items.length) }, () => worker()));
  return results;
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
  if (process.env.CI === '1') {
    const jsonPath = 'ci-simulators.json';

    if (existsSync(jsonPath)) {
      console.log('Using simulators from ci-simulators.json (CI)');
      return JSON.parse(readFileSync(jsonPath, 'utf-8')) as Simulator[];
    }
    throw new Error(`CI mode: ${jsonPath} not found`);
  }

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

/** Install and launch the prebuilt WDA runner on one booted simulator; null if it never binds. */
async function startWda(udid: string, port: number, wdaAppPath: string): Promise<number | null> {
  if (await isWdaResponding(port)) {
    return port; // Left running by an earlier run — reuse it as-is.
  }

  await execAsync(`xcrun simctl install ${udid} "${wdaAppPath}"`);
  // Mirrors what the driver itself does (WebDriverAgent#launchWithPreinstalledWDA): simctl passes
  // SIMCTL_CHILD_-prefixed vars through to the launched process.
  await execAsync(
    `SIMCTL_CHILD_USE_PORT=${port} ` +
      `SIMCTL_CHILD_WDA_PRODUCT_BUNDLE_IDENTIFIER=${WDA_RUNNER_BUNDLE_ID} ` +
      `xcrun simctl launch --terminate-running-process ${udid} ${WDA_RUNNER_BUNDLE_ID}`
  );

  // WDA binds its port a moment after the process starts, so poll rather than assume. The window is
  // generous because missing it is the expensive outcome — that device falls back to launching WDA
  // inside its first session, behind a process-wide lock — while waiting costs only this worker's time.
  // Launching at a bounded width is what keeps the wait short in practice: all twelve at once, each
  // given a fixed 15s, produced WDA on 1 of 12.
  for (let attempt = 0; attempt < WDA_PORT_POLL_ATTEMPTS; attempt++) {
    if (await isWdaResponding(port)) {
      return port;
    }
    await new Promise(resolve => setTimeout(resolve, WDA_PORT_POLL_INTERVAL_MS));
  }

  console.warn(`  WDA on ${udid} (port ${port}) did not bind; falling back for it`);
  return null;
}

/**
 * Boot the pool, install the app on it, and start one long-lived WebDriverAgent per simulator.
 *
 * Pipelined per simulator rather than run as three phases over the whole pool. Three phases would each
 * end on a barrier — a phase only finishes when its slowest device does — so the pool would sit idle at
 * three separate tails. Here a device that boots quickly moves straight on to its own install while
 * others are still booting, with `prepareConcurrency` devices in flight throughout.
 *
 * The stages must run in this order per device: both `simctl install` and `simctl launch` fail on a
 * device that isn't booted ("Unable to lookup in current state: Shutdown"), so neither can be hoisted
 * ahead of the boot.
 *
 * Returns the ports where WDA answered, for `appium:webDriverAgentUrl`. A device missing from that list
 * falls back to the driver launching WDA inside its first session, exactly as it would without any of
 * this — so everything here degrades rather than failing.
 */
export async function prepareSimulatorPool(
  pool: Array<Simulator>,
  { appPath, wdaAppPath }: { appPath?: string; wdaAppPath?: string }
): Promise<Array<number>> {
  if (pool.length === 0) {
    return [];
  }

  const width = prepareConcurrency(pool.length);
  const start = Date.now();
  console.log(
    `Preparing ${pool.length} simulator(s), ${width} at a time ` +
      `(boot${appPath ? ' + app' : ''}${wdaAppPath ? ' + WDA' : ''})...`
  );

  let finished = 0;
  const results = await withConcurrency(pool, width, async ({ udid, wdaPort }) => {
    const deviceStart = Date.now();
    const done: Array<string> = [];
    let port: number | null = null;

    try {
      // `bootstatus -b` boots the device if it isn't already booted and only returns once the boot has
      // actually completed (unlike `simctl boot`, which returns immediately).
      //
      // Timed out because `bootstatus` waits indefinitely by design: a simulator that wedges mid-boot
      // would otherwise hold this call open until CI's own job limit killed the run, hours later. A
      // cold boot measured ~5s at this width, so this is a "something is broken" ceiling, not a budget.
      await execAsync(`xcrun simctl bootstatus ${udid} -b`, { timeout: BOOT_TIMEOUT_MS });
      done.push('booted');

      if (appPath) {
        // Without this the install lands inside the first test to touch the device (~150s for three
        // devices, against ~17s warm). It is an upsert, so repeating it is safe — but not free, which
        // is why CI prepares once up front rather than once per tiered pass.
        await execAsync(`xcrun simctl install ${udid} "${appPath}"`);
        done.push('app');
      }

      if (wdaAppPath) {
        port = await startWda(udid, wdaPort, wdaAppPath);
        done.push(port === null ? 'WDA failed' : 'WDA');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ${udid} could not be prepared (Appium will handle it): ${message}`);
    }

    // Logged per device so a slow pool shows progress rather than going silent for minutes — with 12
    // devices the gap between the opening line and the closing one is otherwise long enough to look
    // like a hang, in CI logs and locally alike.
    finished += 1;
    console.log(
      `  [${finished}/${pool.length}] ${done.join(' + ') || 'nothing'} in ` +
        `${((Date.now() - deviceStart) / 1000).toFixed(1)}s ` +
        `(${((Date.now() - start) / 1000).toFixed(1)}s elapsed)`
    );
    return port;
  });

  const ports = results.filter((port): port is number => port !== null);
  console.log(
    `✓ ${pool.length} simulator(s) prepared in ${((Date.now() - start) / 1000).toFixed(1)}s` +
      (wdaAppPath ? `, WebDriverAgent on ${ports.length}/${pool.length}` : '')
  );
  return ports;
}

/**
 * Ports of the pool's already-running WebDriverAgents.
 *
 * For when an earlier step already prepared the pool: the tiered CI run invokes Playwright once per
 * device class, so global setup runs several times in a job, and redoing the installs each time would
 * cost more than it saves. Probing is one `/status` call per device, so it is safe to do unconditionally.
 */
export async function discoverRunningWda(pool: Array<Simulator>): Promise<Array<number>> {
  const found = await withConcurrency(pool, pool.length, async ({ wdaPort }) =>
    (await isWdaResponding(wdaPort)) ? wdaPort : null
  );
  return found.filter((port): port is number => port !== null);
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
