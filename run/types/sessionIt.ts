// run/types/sessionIt.ts - Clean version matching original pattern
import { test, type TestInfo } from '@playwright/test';
import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import { TestRisk } from './testing';
import type { AppCountPerTest } from '../test/specs/state_builder';
import { omit } from 'lodash';
import {
  captureScreenshotsOnFailure,
  unregisterDevicesForTest,
} from '../test/specs/utils/screenshot_helper';

// Test wrapper configuration
type MobileItArgs = {
  platform: SupportedPlatformsType;
  countOfDevicesNeeded: AppCountPerTest;
  title: string;
  risk: TestRisk;
  testCb: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>;
  shouldSkip?: boolean;
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
    console.info(`\n\n==========> Running "${testName}"\n\n`);

    try {
      // Run the actual test
      await testCb(platform, testInfo);
    } catch (error) {
      // Capture screenshots before re-throwing
      await captureScreenshotsOnFailure(testInfo);
      throw error;
    } finally {
      // Always cleanup
      unregisterDevicesForTest(testInfo);
    }

    // Also check if test is marked as failed after completion
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await captureScreenshotsOnFailure(testInfo);
    }
  });
}

export function bothPlatformsIt(args: Omit<MobileItArgs, 'platform'>) {
  mobileIt({ platform: 'android', ...args });
  mobileIt({ platform: 'ios', ...args });
}

export function bothPlatformsItSeparate(
  args: Omit<MobileItArgs, 'platform' | 'testCb' | 'shouldSkip'> & {
    ios: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
    android: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
  }
) {
  mobileIt({ platform: 'android', ...omit(args, ['ios', 'android']), ...args.android });
  mobileIt({ platform: 'ios', ...omit(args, ['ios', 'android']), ...args.ios });
}
