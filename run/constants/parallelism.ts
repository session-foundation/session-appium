/**
 * Simulator-parallelism tiers.
 *
 * A Playwright worker owns a *fixed* pool of `DEVICES_PER_TEST_COUNT` simulators (see `openiOSApp`
 * in open_app.ts, which offsets each worker's pool by its parallel index). That count is a single
 * global per invocation, so one run cannot give worker 0 four devices and worker 1 two. Sizing it to
 * the largest spec — what CI does today with `DEVICES_PER_TEST_COUNT: 4` — means a `@1-devices` spec
 * occupies a worker holding four simulators and using one.
 *
 * So parallelism is expressed as a series of *passes*: one Playwright invocation per device class,
 * each with its own devices-per-worker and worker count, filtered with `--grep '@N-devices'`. Passes
 * run sequentially, so the simulator draw is the max across passes rather than the sum.
 *
 * MEASUREMENT PROVENANCE — 2026-07-30, `--shard=1/4 --grep-invert @pro`, on a 14-core Apple Silicon
 * host, against a build with the SnodePool use-after-free fix (9 configs, 39 min, zero crashes):
 *
 *   tier        W=1     W=2            W=3            W=4
 *   @1-devices  271s    133s (2.04x)   105s (2.58x)   90s (3.01x)
 *   @2-devices  549s    295s (1.86x)   226s (2.43x)   —
 *   @3-devices  427s    227s (1.88x)   —              —
 *
 * Caveats that matter when tuning these numbers:
 *   - `@4-devices` was never measured. It gets no parallelism below 8 simulators, and those are the
 *     slowest specs in the suite.
 *   - Nothing above W=4 was measured anywhere, on any host.
 *   - Those walls include failing specs, whose timings are not comparable to passing ones.
 *   - Measured on one shard of one host. CI hardware differs, so treat CI numbers as a starting
 *     point to measure from, not as findings.
 *
 * Over-subscribing is not a soft failure: each booted simulator spawns ~280 host processes, and a
 * saturated host produces timeouts that look exactly like product bugs. Prefer raising a tier only
 * after measuring it on the hardware in question.
 */

export type ParallelPass = {
  /**
   * Device count for this pass. Doubles as `DEVICES_PER_TEST_COUNT` and as the `@N-devices` tag
   * that selects the specs, so the pool size and the spec filter cannot drift apart.
   */
  devices: number;
  /** Playwright workers for this pass. Simulators used = `devices * workers`. */
  workers: number;
};

export type ParallelTier = {
  /** Shown by `--tier` / `--list-tiers`; keep it short, it is user-facing. */
  summary: string;
  passes: ParallelPass[];
};

export const PARALLEL_TIERS = {
  /**
   * 4 simulators. The lowest tier worth running: `@1-devices` still parallelises well, but
   * `@3-devices` and `@4-devices` stay serial because they cannot fit two workers into four sims.
   * Measured 812s vs 1247s all-serial on the reference shard (1.54x).
   */
  conservative: {
    summary: '4 simulators — safest; 3- and 4-device specs stay serial',
    passes: [
      { devices: 1, workers: 4 },
      { devices: 2, workers: 2 },
      { devices: 3, workers: 1 },
      { devices: 4, workers: 1 },
    ],
  },

  /**
   * 6 simulators. Every measured pass at its best measured setting. Both 6-simulator configurations
   * ran clean, and `@3-devices` at W=2 was the only configuration in the matrix with zero test
   * failures. Measured 543s vs 1247s all-serial on the reference shard (2.30x).
   */
  standard: {
    summary: '6 simulators — best measured local throughput',
    passes: [
      { devices: 1, workers: 4 },
      { devices: 2, workers: 3 },
      { devices: 3, workers: 2 },
      { devices: 4, workers: 1 },
    ],
  },

  /**
   * 12 simulators, the `IOS_N_SIMULATOR` / ci-simulators.json cap. Every pass fills the pool.
   *
   * A pass boots only `workers × devices` simulators (see global-setup.ts), so the run's peak draw is
   * 12 whichever pass is running. Holding one below that leaves simulators idle without lowering the
   * ceiling, which is why the `@1-devices` pass takes 12 workers rather than fewer.
   *
   * The worker counts above 4 are extrapolated — nothing above W=4 has been measured on any host —
   * and an over-subscribed runner fails in a way indistinguishable from real test failures, the exact
   * problem the old "stay at 1 worker" guidance was written to avoid. Treat the first run on this tier
   * as a measurement, and lower these before concluding a flake is the app's fault.
   */
  ci: {
    summary: '12 simulators — fills the CI pool; worker counts above 4 are unmeasured',
    passes: [
      { devices: 1, workers: 12 },
      { devices: 2, workers: 6 },
      { devices: 3, workers: 4 },
      { devices: 4, workers: 3 },
    ],
  },
} as const satisfies Record<string, ParallelTier>;

/**
 * Emulator-parallelism tiers, the Android counterpart of the table above.
 *
 * The mechanics are identical - `openAndroidApp` offsets each worker's pool by `TEST_PARALLEL_INDEX`
 * exactly as `openiOSApp` does, and `DEVICES_PER_TEST_COUNT` is the same single global per
 * invocation - so parallelism is expressed the same way, as one pass per device class.
 *
 * **The worker counts here are UNMEASURED.** They are the arithmetic that fills the pool
 * (`devices * workers <= emulators`), not findings. The iOS numbers above do not transfer: a booted
 * emulator is a QEMU virtual machine costing gigabytes of RAM, where a simulator is a process tree,
 * so the two saturate a host for entirely different reasons. Treat a first run on any of these as a
 * measurement, and lower the workers before concluding a flake is the app's fault.
 *
 * RAM is the binding constraint, and it is not subtle. Measured on the 64 GB Linux runner with four
 * emulators up: 5.4-7.4 GB PSS each, 24 GB total, essentially all private, so there is no shared-page
 * inflation to discount. Eight lands near 50 GB. Check `free -g` against the tier before running one.
 *
 * Unlike the iOS runner, nothing here provisions anything: Appium will not boot an emulator, so the
 * pool has to be up before the run starts (`pnpm create-emulators <n>`).
 */
export const ANDROID_PARALLEL_TIERS = {
  /** 4 emulators — the pool the suite shipped with. 3- and 4-device specs stay serial. */
  conservative: {
    summary: '4 emulators — safest; 3- and 4-device specs stay serial',
    passes: [
      { devices: 1, workers: 4 },
      { devices: 2, workers: 2 },
      { devices: 3, workers: 1 },
      { devices: 4, workers: 1 },
    ],
  },

  /** 6 emulators — every pass but `@4-devices` gets at least two workers. ~37 GB of emulator RAM. */
  standard: {
    summary: '6 emulators — every pass but @4-devices parallelises',
    passes: [
      { devices: 1, workers: 6 },
      { devices: 2, workers: 3 },
      { devices: 3, workers: 2 },
      { devices: 4, workers: 1 },
    ],
  },

  /**
   * 8 emulators, the `MAX_EMULATORS` cap. The only tier in which `@4-devices` parallelises at all.
   *
   * Near 50 GB of emulator RAM before the tests do anything, so this wants a 64 GB host and nothing
   * else running on it - on the Linux runner that means both GitHub Actions runner services stopped,
   * not just one.
   */
  full: {
    summary: '8 emulators — fills the pool; needs a 64 GB host to itself',
    passes: [
      { devices: 1, workers: 8 },
      { devices: 2, workers: 4 },
      { devices: 3, workers: 2 },
      { devices: 4, workers: 2 },
    ],
  },
} as const satisfies Record<string, ParallelTier>;

export type AndroidParallelTierName = keyof typeof ANDROID_PARALLEL_TIERS;

export const ANDROID_PARALLEL_TIER_NAMES = Object.keys(
  ANDROID_PARALLEL_TIERS
) as AndroidParallelTierName[];

export type ParallelTierName = keyof typeof PARALLEL_TIERS;

export const PARALLEL_TIER_NAMES = Object.keys(PARALLEL_TIERS) as ParallelTierName[];

/** Devices a tier needs: the largest single pass, since passes run one after another. */
export function devicesRequired(tier: ParallelTier): number {
  return Math.max(...tier.passes.map(p => p.devices * p.workers));
}

/**
 * `--grep` for one pass: the platform and device-count tags ANDed via lookaheads, so it composes
 * with any additional filter (risk, `--grep-invert @pro`) the caller already applies.
 */
export function passGrep(pass: ParallelPass, platform: 'android' | 'ios' = 'ios'): string {
  return `(?=.*@${platform})(?=.*@${pass.devices}-devices)`;
}
