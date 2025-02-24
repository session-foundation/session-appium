import dotenv from 'dotenv';
dotenv.config();

import { defineConfig } from '@playwright/test';
import {
  getRepeatEachCount,
  getRetriesCount,
  getWorkersCount,
} from './run/test/specs/utils/binaries';

const useSessionReporter = true;
// NOTE: without this, the wrong source map is loaded and the stacktraces are all wrong
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('source-map-support').install = () => {};

export default defineConfig({
  timeout: 480000,
  globalTimeout: 12800000, // extends timeout to run full suite with 3 retries
  reporter: [useSessionReporter ? ['./sessionReporter.ts'] : ['list']],
  testDir: './run/test/specs',
  testIgnore: '*.js',
  // outputDir: './tests/automation/test-results',
  retries: getRetriesCount(),
  repeatEach: getRepeatEachCount(),
  workers: getWorkersCount(),
  reportSlowTests: null,
  fullyParallel: true, // otherwise, tests in the same file are not run in parallel
});
