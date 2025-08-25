import dotenv from 'dotenv';
dotenv.config();

import { defineConfig, ReporterDescription } from '@playwright/test';

import { allureResultsDir } from './run/constants/allure';
import {
  getRepeatEachCount,
  getRetriesCount,
  getWorkersCount,
} from './run/test/specs/utils/binaries';

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
  workers: getWorkersCount(),
  reportSlowTests: null,
  fullyParallel: true, // otherwise, tests in the same file are not run in parallel
});
