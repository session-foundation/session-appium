import { execSync } from 'child_process';
import dotenv from 'dotenv';

import { bootSimulatorPool, resolveRunSimulators } from './ios_shared';

// Standalone CLI, so it loads .env itself (as run_ios_parallel.ts does) to pick up IOS_N_SIMULATOR.
// On CI the pool comes from ci-simulators.json instead and this is a no-op.
dotenv.config({ quiet: true });

/**
 * Measure how long the simulator pool takes to cold-boot at several concurrency widths, on whichever
 * host is running this.
 *
 * The right width is host-dependent: booting eight cold simulators one at a time was measured at ~11s
 * each on a 14-core laptop, while the 12-simulator CI pool booting all at once averaged ~29s each — but
 * those are different machines, so the comparison can't be trusted to pick a number. Rather than
 * configure a guess, this runs every candidate width back-to-back on the runner and prints a table.
 *
 * Each width is measured from genuinely cold: every simulator is shut down first, and the teardown is
 * allowed to finish draining before the clock starts, so one width's cleanup isn't charged to the next.
 *
 * Deliberately measures boot alone, not the app install or WebDriverAgent launch that follow it. Both
 * of those *require* an already-booted simulator (`simctl install` and `simctl launch` on a shut-down
 * device both fail with "Unable to lookup in current state: Shutdown"), so boot is the part every
 * strategy has to pay and the only part a width can change.
 *
 * Usage:
 *   npx ts-node scripts/bench_simulator_boot.ts            # widths 1,2,3,4,6,12 capped to the pool
 *   npx ts-node scripts/bench_simulator_boot.ts 1 4 12     # only these widths
 */

const DEFAULT_WIDTHS = [1, 2, 3, 4, 6, 12];

/**
 * Below this many processes exiting between polls, the teardown is treated as done. Small enough that
 * it only trips once the simulators have really gone, large enough to ignore unrelated churn.
 */
const PROCESS_SETTLE_DELTA = 25;

/** Load average is the clearest signal of the contention we're trying to measure. */
function loadAverage(): number {
  const [, oneMinute] = execSync('sysctl -n vm.loadavg').toString().trim().split(/\s+/);
  return Number(oneMinute);
}

/** Process count, which is what actually saturates the host — each booted simulator holds ~230. */
function processCount(): number {
  return Number(execSync('ps ax | wc -l').toString().trim());
}

function bootedCount(): number {
  const listing = execSync('xcrun simctl list devices').toString();
  return (listing.match(/\(Booted\)/g) ?? []).length;
}

const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1_000));

/**
 * Shut every simulator down and wait for the host to quieten.
 *
 * Readiness is judged by the process count levelling off, deliberately **not** by load average.
 * Load average is a ~1-minute exponentially-weighted mean, so after a 12-simulator shutdown it sits in
 * the hundreds and decays ~8% per 5s: waiting for it to reach any "quiet" number takes about five
 * minutes, which made an earlier version of this burn its entire timeout before every measurement.
 * Process count, by contrast, drops as the processes actually exit — it reflects the state we care
 * about at the moment we care about it.
 *
 * "Levelled off" rather than "back to a baseline" so this needs no calibration: the teardown is done
 * when successive polls stop finding fewer processes. Bounded regardless, so a busy runner can't hang
 * the job.
 */
async function resetToCold(maxSettleSeconds: number): Promise<void> {
  console.log('  shutting down all simulators...');
  execSync('xcrun simctl shutdown all', { stdio: 'ignore' });

  for (let waited = 0; waited < 120 && bootedCount() > 0; waited += 2) {
    await sleep(2);
  }

  const started = Date.now();
  let previous = processCount();
  while ((Date.now() - started) / 1_000 < maxSettleSeconds) {
    await sleep(3);
    const current = processCount();
    const drained = previous - current;
    previous = current;

    if (drained < PROCESS_SETTLE_DELTA) {
      console.log(`  settled: ${current} processes, load ${loadAverage().toFixed(1)}`);
      return;
    }
    // Printed every poll so a slow teardown shows progress instead of going silent.
    console.log(`  draining: ${current} processes (-${drained})`);
  }
  console.log(`  settle timed out after ${maxSettleSeconds}s at ${processCount()} processes`);
}

type Measurement = {
  bootedAfter: number;
  loadAfter: number;
  processesAfter: number;
  seconds: number;
  width: number;
};

async function measureWidth(udids: string[], width: number): Promise<Measurement> {
  await resetToCold(120);
  console.log(
    `\n--- width ${width} --- (cold: ${bootedCount()} booted, ${processCount()} processes, ` +
      `load ${loadAverage().toFixed(1)})`
  );

  const started = Date.now();
  await bootSimulatorPool(udids, width);
  const seconds = (Date.now() - started) / 1_000;

  return {
    bootedAfter: bootedCount(),
    loadAfter: loadAverage(),
    processesAfter: processCount(),
    seconds,
    width,
  };
}

async function main(): Promise<void> {
  const requested = process.argv
    .slice(2)
    .map(Number)
    .filter(width => Number.isInteger(width) && width > 0);
  const pool = resolveRunSimulators();
  const udids = pool.map(simulator => simulator.udid);

  if (udids.length === 0) {
    throw new Error('No simulators resolved — set IOS_N_SIMULATOR in .env, or run with CI=1.');
  }

  // Widths above the pool size are the same measurement as the pool size, so collapse them rather than
  // timing the identical case several times.
  const widths = [
    ...new Set(
      (requested.length > 0 ? requested : DEFAULT_WIDTHS).map(width =>
        Math.min(width, udids.length)
      )
    ),
  ].sort((a, b) => a - b);

  console.log(
    `Benchmarking cold boot of ${udids.length} simulator(s) at width(s): ${widths.join(', ')}`
  );

  const results: Array<Measurement> = [];
  for (const width of widths) {
    results.push(await measureWidth(udids, width));
  }

  await resetToCold(60);

  const fastest = Math.min(...results.map(result => result.seconds));
  console.log(
    `\n${'width'.padStart(5)} ${'total'.padStart(8)} ${'per sim'.padStart(8)} ${'vs best'.padStart(8)}  booted  processes  load`
  );
  for (const result of results) {
    const perSim = result.seconds / udids.length;
    const ratio = result.seconds / fastest;
    const incomplete = result.bootedAfter === udids.length ? '' : '  <-- INCOMPLETE BOOT';
    console.log(
      `${String(result.width).padStart(5)} ${(result.seconds.toFixed(1) + 's').padStart(8)} ` +
        `${(perSim.toFixed(1) + 's').padStart(8)} ${(ratio.toFixed(2) + 'x').padStart(8)}  ` +
        `${String(result.bootedAfter).padStart(6)}  ${String(result.processesAfter).padStart(9)}  ` +
        `${result.loadAfter.toFixed(1)}${incomplete}`
    );
  }

  const best = results.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
  console.log(
    `\nFastest width on this host: ${best.width} (${best.seconds.toFixed(1)}s for ${udids.length} ` +
      `simulators). Set IOS_BOOT_CONCURRENCY=${best.width}, or change DEFAULT_BOOT_CONCURRENCY in ` +
      `scripts/ios_shared.ts.`
  );
  console.log(
    'A width that failed to boot the whole pool is not a candidate however fast it looks — check the ' +
      'booted column.'
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
