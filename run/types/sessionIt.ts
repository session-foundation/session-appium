/* eslint-disable no-empty-pattern */
import { test, type TestInfo } from '@playwright/test';
import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import { TestRisk } from './testing';

export function androidIt(
  title: string,
  testRisk: TestRisk,
  testToRun: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>,
  shouldSkip = false
) {
  const testName = `${title} android @${testRisk ?? 'default'}-risk`;
  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
  } else {
    test(testName, async ({}, testInfo) => {
      console.info(`\n\n==========> Running "${testName}"\n\n`);
      await testToRun('android', testInfo);
    });
  }
}

export function iosIt(
  title: string,
  testRisk: TestRisk,
  testToRun: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>,
  shouldSkip = false
) {
  const testName = `${title} ios @${testRisk ?? 'default'}-risk`;

  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
  } else {
    test(testName, async ({}, testInfo) => {
      console.info(`\n\n==========> Running "${testName}"\n\n`);
      const startTime = Date.now();
      await testToRun('ios', testInfo);
      const endTime = Date.now();
      console.info(`\n\n==========> Finished "${testName}" in ${endTime - startTime}ms\n\n`);
    });
  }
}

function mobileIt(
  platform: SupportedPlatformsType,
  title: string,
  testRisk: TestRisk,
  testToRun: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>,
  shouldSkip = false
) {
  const testName = `${title} ${platform} @${testRisk ?? 'default'}-risk`;
  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
  } else {
    test(testName, async ({}, testInfo) => {
      console.info(`\n\n==========> Running "${testName}"\n\n`);
      await testToRun(platform, testInfo);
    });
  }
}

export function bothPlatformsIt(
  title: string,
  testRisk: TestRisk,
  testToRun: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>,
  shouldSkip = false
) {
  // Define test for Android
  mobileIt('android', title, testRisk, testToRun, shouldSkip);

  // Define test for iOS
  mobileIt('ios', title, testRisk, testToRun, shouldSkip);
}
