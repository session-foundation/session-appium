import dotenv from 'dotenv';
dotenv.config();

import { defineConfig } from '@playwright/test';
import {
  getRepeatEachCount,
  getRetriesCount,
  getWorkersCount,
} from './run/test/specs/utils/binaries';

// NOTE: without this, the wrong source map is loaded and the stacktraces are all wrong
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('source-map-support').install = () => {};

export default defineConfig({
  timeout: 480000,
  globalTimeout: 18000000, // extends timeout to 5 hours run full suite with 3 retries
  /**
   * Note: `playwright-reporter` below is our custom playwright reporter.
   * It accepts a few options as environment variables, see its Readme.md file for more info.
   */
  reporter: [['./node_modules/@session-foundation/playwright-reporter/dist/index.js'], ['allure-playwright', {outputFolder: 'allure/allure-results'}]],
  testDir: './run/test/specs',
  testIgnore: '*.js',
  // outputDir: './tests/automation/test-results',
  retries: getRetriesCount(),
  repeatEach: getRepeatEachCount(),
  workers: getWorkersCount(),
  reportSlowTests: null,
  fullyParallel: true, // otherwise, tests in the same file are not run in parallel
});
