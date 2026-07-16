import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { defineConfig, ReporterDescription } from '@playwright/test';

import { allureResultsDir } from './run/constants/allure';
import {
  getRepeatEachCount,
  getRetriesCount,
  getWorkersCount,
  type WorkersPlatform,
} from './run/test/utils/binaries';

// A run always targets a single platform, but that platform is expressed differently depending
// on the entrypoint: CI sets the PLATFORM env variable, while the local `test-*` scripts only
// pass it through the `--grep`/`--project` CLI args. Resolve both so the right per-platform
// worker count is picked. Returns undefined for the cross-platform project (no dedicated count).
function currentTestPlatform(): WorkersPlatform | undefined {
  const fromEnv = process.env.PLATFORM;
  if (fromEnv === 'android' || fromEnv === 'ios' || fromEnv === 'desktop') {
    return fromEnv;
  }
  const argv = process.argv.join(' ');
  if (/@ios\b/.test(argv)) return 'ios';
  if (/@android\b/.test(argv)) return 'android';
  if (/(^|\s|--project[= ])desktop\b/.test(argv)) return 'desktop';
  return undefined;
}

// NOTE: without this, the wrong source map is loaded and the stacktraces are all wrong
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('source-map-support').install = () => {};

const useAllure = process.env.CI === '1' && process.env.ALLURE_ENABLED !== 'false';
const baseReporter: ReporterDescription = [
  './node_modules/@session-foundation/playwright-reporter/dist/index.js',
];
const allureReporter: ReporterDescription = [
  'allure-playwright',
  {
    detail: false, // No Playwright internal steps in the test body
    resultsDir: allureResultsDir,
    categories: [
      {
        name: 'Self-healed tests', // Custom category to group healed tests for better visibility
        messageRegex: '.*healed.*',
      },
    ],
  },
];

export default defineConfig({
  timeout: 480000,
  globalTimeout: 18000000, // extends timeout to 5 hours run full suite with 3 retries
  reporter: useAllure ? [baseReporter, allureReporter] : [baseReporter],
  globalSetup: require.resolve('./global-setup'),
  testDir: './run/test/specs',
  testIgnore: '*.js',
  // outputDir: './tests/automation/test-results',
  retries: getRetriesCount(),
  repeatEach: getRepeatEachCount(),
  workers: getWorkersCount(currentTestPlatform()),
  reportSlowTests: null,
  fullyParallel: true, // otherwise, tests in the same file are not run in parallel
  // One project per suite: each suite has a distinct runtime profile (mobile needs an
  // emulator, desktop needs Electron, cross-platform needs both). testDir stays the same and
  // each project narrows to its own folder via testMatch. android/ios are NOT separate
  // projects: `bothPlatformsIt` registers both an @android and an @ios test from the same
  // file, so they are split with `--grep '@android'` / `'@ios'` inside `--project mobile`.
  projects: [
    {
      name: 'mobile',
      testMatch: /specs\/mobile\/.*\.spec\.ts$/,
    },
    {
      name: 'desktop',
      testMatch: /specs\/desktop\/.*\.spec\.ts$/,
    },
    {
      name: 'cross-platform',
      testMatch: /specs\/cross_platform\/.*\.spec\.ts$/,
    },
  ],
});
