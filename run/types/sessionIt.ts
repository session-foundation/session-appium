// run/types/sessionIt.ts - Clean version matching original pattern
import { test, type TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { omit } from 'lodash';

import type { AppCountPerTest } from '../test/specs/state_builder';

import { getNetworkTarget } from '../test/specs/utils/devnet';
import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import {
  captureScreenshotsOnFailure,
  unregisterDevicesForTest,
} from '../test/specs/utils/screenshot_helper';
import { AllureSuiteConfig } from './allure';
import { TestRisk } from './testing';

// Test wrapper configuration
type MobileItArgs = {
  platform: SupportedPlatformsType;
  countOfDevicesNeeded: AppCountPerTest;
  title: string;
  risk: TestRisk;
  testCb: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>;
  shouldSkip?: boolean;
  allureSuites?: AllureSuiteConfig;
  allureDescription?: string;
};

export function androidIt(args: Omit<MobileItArgs, 'platform'>) {
  mobileIt({ ...args, platform: 'android' });
}

export function iosIt(args: Omit<MobileItArgs, 'platform'>) {
  mobileIt({ ...args, platform: 'ios' });
}

function mobileIt({
  platform,
  risk,
  testCb,
  title,
  shouldSkip = false,
  countOfDevicesNeeded,
  allureSuites,
  allureDescription,
}: MobileItArgs) {
  const testName = `${title} @${platform} @${risk ?? 'default'}-risk @${countOfDevicesNeeded}-devices`;

  if (shouldSkip) {
    test.skip(testName, () => {
      console.info(`\n\n==========> Skipping "${testName}"\n\n`);
    });
    return;
  }

  // eslint-disable-next-line no-empty-pattern
  test(testName, async ({}, testInfo) => {
    getNetworkTarget(platform);
    console.info(`\n\n==========> Running "${testName}"\n\n`);

    if (allureSuites) {
      await allure.parentSuite(allureSuites.parent);
      if ('suite' in allureSuites) {
        await allure.suite(allureSuites.suite);
      }
    }
    if (allureDescription) {
      await allure.description(allureDescription);
    }
    let testFailed = false;

    try {
      await testCb(platform, testInfo);
    } catch (error) {
      testFailed = true; // Playwright hasn't updated testInfo.status yet, so track failure manually
      throw error;
    } finally {
      // NOTE: This finally block runs for thrown errors but NOT for:
      // - Test timeouts (Playwright kills execution before finally)
      // - Interrupts/Ctrl+C (Process terminated before finally)
      // If timeout screenshots become important, consider using test fixtures
      // or racing against a custom timeout promise
      try {
        // Check for test failure - either our flag or Playwright's status
        if (
          testFailed ||
          testInfo.errors.length > 0 ||
          testInfo.status === 'failed' ||
          testInfo.status === 'timedOut'
        ) {
          await captureScreenshotsOnFailure(testInfo);
        }
      } catch (screenshotError) {
        console.error('Failed to capture screenshot:', screenshotError);
      }

      try {
        unregisterDevicesForTest(testInfo);
      } catch (cleanupError) {
        console.error('Failed to unregister devices:', cleanupError);
      }
    }
  });
}

export function bothPlatformsIt(args: Omit<MobileItArgs, 'platform'>) {
  mobileIt({ platform: 'android', ...args });
  mobileIt({ platform: 'ios', ...args });
}

export function bothPlatformsItSeparate(
  args: Omit<MobileItArgs, 'platform' | 'shouldSkip' | 'testCb'> & {
    ios: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
    android: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
  }
) {
  mobileIt({ platform: 'android', ...omit(args, ['ios', 'android']), ...args.android });
  mobileIt({ platform: 'ios', ...omit(args, ['ios', 'android']), ...args.ios });
}
