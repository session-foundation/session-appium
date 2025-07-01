// run/types/sessionIt.ts - Clean version matching original pattern
import { test, type TestInfo } from '@playwright/test';
import { omit } from 'lodash';

import type { AppCountPerTest } from '../test/specs/state_builder';

import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import {
  captureScreenshotsOnFailure,
  unregisterDevicesForTest,
} from '../test/specs/utils/screenshot_helper';
import { TestRisk } from './testing';

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
      // Run the test
      await testCb(platform, testInfo);
    } finally {
      try { 
       // Check all possible failure conditions
        const shouldCaptureScreenshot = 
          testInfo.errors.length > 0 ||                    
          testInfo.status === 'failed' ||
          testInfo.status === 'timedOut' ||       
          testInfo.status === 'interrupted';  
        
        if (shouldCaptureScreenshot) {
          await captureScreenshotsOnFailure(testInfo);
        }
      } catch (screenshotError) {
        // Don't let screenshot errors mask the original test failure
        console.error('Failed to capture screenshot:', screenshotError);
      }
      
      // Devices must always be unregistered
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
  args: Omit<MobileItArgs, 'platform' | 'testCb' | 'shouldSkip'> & {
    ios: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
    android: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
  }
) {
  mobileIt({ platform: 'android', ...omit(args, ['ios', 'android']), ...args.android });
  mobileIt({ platform: 'ios', ...omit(args, ['ios', 'android']), ...args.ios });
}
