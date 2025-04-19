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
    // eslint-disable-next-line no-empty-pattern
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
    // eslint-disable-next-line no-empty-pattern
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
  testToRun: (platform: SupportedPlatformsType) => Promise<void>,
  shouldSkip = false
) {
  const testName = `${title} ${platform} @${testRisk ?? 'default'}-risk`;
  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
  } else {
    test(testName, async () => {
      console.info(`\n\n==========> Running "${testName}"\n\n`);
      await testToRun(platform);
    });
  }
}

export function bothPlatformsIt(
  title: string,
  testRisk: TestRisk,
  testToRun: (platform: SupportedPlatformsType) => Promise<void>,
  shouldSkip = false
) {
  // Define test for Android
  mobileIt('android', title, testRisk, testToRun, shouldSkip);

  // Define test for iOS
  mobileIt('ios', title, testRisk, testToRun, shouldSkip);
}

// Define the function to accept the title, a setup data object, and a test function that uses this object.
// export function iosItWithSetup(
//   title: string,
//   setupData: SetupData,
//   testToRun: (setupData: {
//     device1: DeviceWrapper;
//     device2: DeviceWrapper;
//     device3: DeviceWrapper;
//     userA: User;
//     userB: User;
//   }) => Promise<void>
// ) {
//   const testName = `${title} ios`;

//   return test(testName, async () => {
//     console.info(`\n\n==========> Running "${testName}" with setup data\n\n`);
//     await testToRun({
//       device1: setupData.device1!,
//       device2: setupData.device2!,
//       device3: setupData.device3!,
//       userA: setupData.userA!,
//       userB: setupData.userB!,
//     });
//   });
// }
