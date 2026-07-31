import dotenv from 'dotenv';
import { appendFileSync } from 'fs';

import { ensureWdaBuilt } from './build_wda';
import { prepareSimulatorPool, resolveRunSimulators } from './ios_shared';

// Standalone CLI, so it loads .env itself (as run_ios_parallel.ts does) to pick up IOS_N_SIMULATOR and
// IOS_APP_PATH_PREFIX. On CI the pool comes from ci-simulators.json and these come from the workflow.
dotenv.config({ quiet: true });

/**
 * Get the simulator pool ready before any test runs: booted, app installed, WebDriverAgent running.
 *
 * `global-setup.ts` can do all of this itself, and does locally. This exists for CI, where the run is
 * **tiered** — one `npx playwright test` invocation per device class — so global setup would otherwise
 * repeat the whole preparation once per pass. Doing it in a step of its own means it happens once, its
 * cost shows up as its own line in the job timing instead of being charged to the first test pass, and
 * the `xcodebuild` output doesn't interleave with test results.
 *
 * Sets IOS_SIMULATORS_PREPARED for later steps (via GITHUB_ENV on CI), which tells global setup to skip
 * straight to discovering the running WebDriverAgents rather than preparing the pool again.
 *
 * Usage:
 *   npx ts-node scripts/prepare_ios.ts            # whole configured pool
 *   npx ts-node scripts/prepare_ios.ts 6          # first 6 simulators only
 */

const PREPARED_FLAG = 'IOS_SIMULATORS_PREPARED';

async function main(): Promise<void> {
  const [requested] = process.argv.slice(2).map(Number);
  const available = resolveRunSimulators();
  const pool =
    Number.isInteger(requested) && requested > 0 ? available.slice(0, requested) : available;

  if (pool.length === 0) {
    throw new Error('No simulators resolved — set IOS_N_SIMULATOR in .env, or run with CI=1.');
  }

  // Built before the pool work rather than inside it: it is one `xcodebuild` for all devices, not a
  // per-device step, and every device needs the result. A failure here is not fatal — without a
  // prebuilt runner the driver builds and launches WDA itself, as it did before any of this existed.
  let wdaAppPath: string | undefined;
  try {
    wdaAppPath = ensureWdaBuilt();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not build WebDriverAgent (the driver will build its own): ${message}`);
  }

  await prepareSimulatorPool(pool, {
    appPath: process.env.IOS_APP_PATH_PREFIX,
    wdaAppPath,
  });

  // Consumed by global-setup.ts in the steps that follow. On CI, GITHUB_ENV is how a step exports a
  // variable to later steps; locally there is no such channel, and none is needed — a local run does
  // its preparation inside global setup anyway.
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `${PREPARED_FLAG}=1\n`);
    console.log(`Exported ${PREPARED_FLAG}=1 for subsequent steps.`);
  }
}

main().catch((error: unknown) => {
  // Deliberately exits 0: every part of this is an optimisation with a working fallback, so a failure
  // here should not fail the job before a single test has run.
  console.warn(
    `Simulator preparation did not complete (the run will fall back to preparing on demand): ` +
      `${error instanceof Error ? error.message : String(error)}`
  );
});
