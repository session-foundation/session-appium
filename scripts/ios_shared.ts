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

/**
 * How long to wait for a freshly launched WDA to bind its port.
 *
 * The first attempt gets a short window (20 x 500ms = 10s) because a healthy launch binds in ~3.3s on
 * average, so anything much beyond that is a wedged runner rather than a slow one — and a short window
 * makes the terminate-and-retry below cheap to reach. The retry gets the full 30s, since by then we
 * have paid for a termination and want it to succeed.
 */
const WDA_FIRST_BIND_ATTEMPTS = 20;
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
 * How many WebDriverAgent launches run at once, from IOS_WDA_CONCURRENCY.
 *
 * **Serial by default.** Overlapping launches was the most expensive thing measured in this step: on the
 * runner a `simctl launch` costs ~0.3s when nothing else is starting up and 130-150s when it overlaps
 * booting simulators.
 *
 * Note this now bounds launches *within a wave*, and `prepareSimulatorPool` already guarantees no boot is
 * in flight while a wave launches — so this is a second-order dial rather than the thing that matters.
 * Raising it lets a wave's launches overlap each other, which is untested; the 0.3s figure is for a
 * launch with nothing else running at all.
 */
const DEFAULT_WDA_CONCURRENCY = 1;

function wdaConcurrency(poolSize: number): number {
  const configured = process.env.IOS_WDA_CONCURRENCY?.trim();
  if (!configured) {
    return Math.min(DEFAULT_WDA_CONCURRENCY, poolSize);
  }

  const width = Number(configured);
  if (!Number.isInteger(width) || width < 1) {
    console.warn(
      `Ignoring IOS_WDA_CONCURRENCY="${configured}" (expected a positive integer); ` +
        `launching ${DEFAULT_WDA_CONCURRENCY} at a time.`
    );
    return Math.min(DEFAULT_WDA_CONCURRENCY, poolSize);
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

/**
 * A snapshot of how busy the host is, for correlating slow stages with load.
 *
 * Boot, app install and WDA launch all run code *inside* a simulator, so they compete for host CPU with
 * every other simulator being prepared and with the whole already-booted pool (~230 processes each). The
 * stages that run no guest code — the port probe, the bundle install — are consistently fast, which is
 * what suggests contention rather than anything wrong with CoreSimulator itself.
 *
 * Process count is instantaneous and the more useful of the two; load average is a ~1-minute mean and so
 * lags, but it captures sustained pressure that a single sample misses. Both are cheap enough to take
 * per device.
 */
function hostSnapshot(): string {
  try {
    const load = execSync('sysctl -n vm.loadavg').toString().trim().split(/\s+/)[1];
    const procs = execSync('ps ax | wc -l').toString().trim();
    return `load ${load}, ${procs} procs`;
  } catch {
    return 'load unavailable';
  }
}

/** Per-stage durations in ms, for working out where preparation actually spends its time. */
type StageTimings = Record<string, number>;

/**
 * Install and launch the prebuilt WDA runner on one booted simulator; null if it never binds.
 *
 * Records each step separately in `timings`. The three are very different operations — a bundle
 * install, a process launch, then a wait on a port — and lumping them together is what left the
 * previous run's 284s unexplained.
 */
async function startWda(
  udid: string,
  port: number,
  wdaAppPath: string,
  timings: StageTimings
): Promise<number | null> {
  const step = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
    const began = Date.now();
    try {
      return await task();
    } finally {
      timings[name] = (timings[name] ?? 0) + (Date.now() - began);
    }
  };

  if (await step('wda-probe', () => isWdaResponding(port))) {
    return port; // Left running by an earlier run — reuse it as-is.
  }

  await step('wda-install', () => execAsync(`xcrun simctl install ${udid} "${wdaAppPath}"`));

  // Mirrors what the driver itself does (WebDriverAgent#launchWithPreinstalledWDA): simctl passes
  // SIMCTL_CHILD_-prefixed vars through to the launched process.
  const launch = (terminateFirst: boolean) =>
    execAsync(
      `SIMCTL_CHILD_USE_PORT=${port} ` +
        `SIMCTL_CHILD_WDA_PRODUCT_BUNDLE_IDENTIFIER=${WDA_RUNNER_BUNDLE_ID} ` +
        `xcrun simctl launch ${terminateFirst ? '--terminate-running-process ' : ''}` +
        `${udid} ${WDA_RUNNER_BUNDLE_ID}`
    );

  // WDA binds its port a moment after the process starts, so poll rather than assume.
  const waitForBind = async (attempts: number): Promise<number | null> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await isWdaResponding(port)) {
        return port;
      }
      await new Promise(resolve => setTimeout(resolve, WDA_PORT_POLL_INTERVAL_MS));
    }
    return null;
  };

  // Launched WITHOUT `--terminate-running-process`, which measured as the single most expensive thing
  // in the whole preparation: 358.6s across 12 devices, against 164.7s for every boot and 148.7s for
  // every app install. It was also wildly uneven — under 3.5s on seven devices but 37s on three and
  // ~120s on two, always on devices launching at the same moment, which points at the termination
  // waiting on something the simulator serialises globally.
  //
  // Skipping it is safe here because the probe above already established nothing is answering on the
  // port: there is usually no process to terminate, so the flag was buying nothing on the happy path.
  await step('wda-launch', () => launch(false));

  const bound = await step('wda-bind-wait', () => waitForBind(WDA_FIRST_BIND_ATTEMPTS));
  if (bound !== null) {
    return bound;
  }

  // Nothing bound, so the port is likely held by a wedged runner from an earlier job — the one case
  // the terminate flag exists for. Pay for it only here, on the path that has already failed, rather
  // than on all twelve devices. The first window is deliberately short so reaching this stays cheap.
  await step('wda-relaunch', () => launch(true));

  const rebound = await step('wda-rebind-wait', () => waitForBind(WDA_PORT_POLL_ATTEMPTS));
  if (rebound === null) {
    console.warn(`  WDA on ${udid} (port ${port}) did not bind; falling back for it`);
  }
  return rebound;
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

  const bootWidth = prepareConcurrency(pool.length);
  const launchWidth = wdaConcurrency(pool.length);
  const start = Date.now();
  const waves = chunk(pool, bootWidth);
  console.log(
    `Preparing ${pool.length} simulator(s) in ${waves.length} wave(s) of ${bootWidth}: ` +
      `boot${appPath ? ' + app' : ''} together, then ` +
      `${wdaAppPath ? `WDA ${launchWidth} at a time with nothing else running` : 'no WDA'}...`
  );

  type Booted = {
    deviceStart: number;
    readyAt: number;
    simulator: Simulator;
    timings: StageTimings;
  };

  const launchedPorts: Array<number> = [];
  const allTimings: Array<StageTimings> = [];
  let finished = 0;

  const makeStep =
    (timings: StageTimings) =>
    async <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const began = Date.now();
      try {
        return await task();
      } finally {
        timings[name] = (timings[name] ?? 0) + (Date.now() - began);
      }
    };

  // Boots and WDA launches alternate and never overlap, which is the whole design here.
  //
  // Measured on the runner: a `simctl launch` that overlaps *no* booting simulator costs ~0.3s, and one
  // that overlaps two or three costs 130-150s. Every run at boot width 2 or 3 hit exactly one of those
  // pathological launches, and everything behind it queued (868s and 1430s of handoff-wait respectively).
  // Width 1 avoided it entirely — 12 launches totalling 5.6s — but only because a serial producer means
  // a launch never overlaps more than one boot, which also gives up all boot parallelism.
  //
  // Alternating recovers that parallelism without reintroducing the overlap: each wave boots `bootWidth`
  // devices together, then launches them with nothing else in flight.
  //
  // This deliberately reintroduces a barrier per wave, which an earlier version of this function went out
  // of its way to avoid. That trade is now the right way round: the barrier costs the difference between
  // the slowest and average boot in a wave (a few seconds), against a 130-150s launch if the phases are
  // allowed to overlap.
  for (const [waveIndex, wave] of waves.entries()) {
    // --- phase 1: boot and install the whole wave concurrently ----------------------------------------
    const booted = await withConcurrency(wave, bootWidth, async simulator => {
      const timings: StageTimings = {};
      allTimings.push(timings);
      const deviceStart = Date.now();
      const step = makeStep(timings);

      try {
        // `bootstatus -b` boots the device if it isn't already booted and only returns once the boot has
        // actually completed (unlike `simctl boot`, which returns immediately).
        //
        // Timed out because `bootstatus` waits indefinitely by design: a simulator that wedges mid-boot
        // would otherwise hold this open until CI's own job limit killed the run, hours later. A cold
        // boot measured ~10-22s, so this is a "something is broken" ceiling, not a budget.
        await step('boot', () =>
          execAsync(`xcrun simctl bootstatus ${simulator.udid} -b`, { timeout: BOOT_TIMEOUT_MS })
        );

        if (appPath) {
          // Guest-side work, so it contends like the boot does: ~5s per device early in a run against
          // ~22s once the pool is full. Kept in this phase for that reason — it must not overlap a launch
          // either. Worth doing at all because left to the driver it lands inside the first test.
          await step('app-install', () =>
            execAsync(`xcrun simctl install ${simulator.udid} "${appPath}"`)
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `  ${simulator.udid} could not be prepared (Appium will handle it): ${message}`
        );
      }

      return { deviceStart, readyAt: Date.now(), simulator, timings } satisfies Booted;
    });

    // --- phase 2: launch WDA across the wave, with no boots in flight ---------------------------------
    await withConcurrency(booted, launchWidth, async device => {
      // Time between this device being ready and its launch starting: the wave barrier plus its place in
      // the launch order. Small by construction now — a wave's launches total ~1s — so if this ever grows
      // large again it means a launch has gone pathological despite the phases being separated.
      device.timings['handoff-wait'] = Date.now() - device.readyAt;

      let port: number | null = null;
      let hostAtLaunch = 'not applicable';
      if (wdaAppPath) {
        // Sampled here because general load turned out not to predict launch cost (0.4s at load 731,
        // 17.9s at load 147); what predicts it is whether a boot is in flight, which this phase prevents.
        hostAtLaunch = hostSnapshot();
        try {
          port = await startWda(
            device.simulator.udid,
            device.simulator.wdaPort,
            wdaAppPath,
            device.timings
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`  ${device.simulator.udid} WDA launch failed (falling back): ${message}`);
        }
      }

      if (port !== null) {
        launchedPorts.push(port);
      }

      // Logged per device so a slow pool shows progress rather than going silent for minutes. The
      // per-stage breakdown is what makes a slow device diagnosable from the log alone.
      finished += 1;
      const breakdown = Object.entries(device.timings)
        .map(([name, ms]) => `${name} ${(ms / 1000).toFixed(1)}s`)
        .join(', ');
      console.log(
        `  [${finished}/${pool.length}] w${waveIndex + 1} ` +
          `${port === null && wdaAppPath ? 'WDA FAILED — ' : ''}` +
          `${((Date.now() - device.deviceStart) / 1000).toFixed(1)}s total (${breakdown || 'nothing'}) ` +
          `at ${((Date.now() - start) / 1000).toFixed(1)}s elapsed` +
          `${wdaAppPath ? ` | host at WDA launch: ${hostAtLaunch}` : ''}`
      );
    });
  }

  const ports = launchedPorts;
  console.log(
    `✓ ${pool.length} simulator(s) prepared in ${((Date.now() - start) / 1000).toFixed(1)}s` +
      (wdaAppPath ? `, WebDriverAgent on ${ports.length}/${pool.length}` : '')
  );

  // Summed across devices, so the dominant stage is obvious without adding up twelve lines by hand.
  // These are sums of concurrent work, so they exceed the wall clock — the ratios are the point, not
  // the totals.
  const totals: StageTimings = {};
  for (const timings of allTimings) {
    for (const [name, ms] of Object.entries(timings)) {
      totals[name] = (totals[name] ?? 0) + ms;
    }
  }
  const busiest = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (busiest.length > 0) {
    console.log(
      `  stage totals across ${pool.length} device(s) (concurrent, so they sum above wall clock): ` +
        busiest.map(([name, ms]) => `${name} ${(ms / 1000).toFixed(1)}s`).join(', ')
    );
  }
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
