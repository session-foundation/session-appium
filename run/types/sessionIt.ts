/* eslint-disable no-empty-pattern */
import { test, type TestInfo } from '@playwright/test';
import { SupportedPlatformsType } from '../test/specs/utils/open_app';
import { TestRisk } from './testing';
import type { AppCountPerTest } from '../test/specs/state_builder';
import { omit } from 'lodash';

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
  } else {
    test(testName, async ({}, testInfo) => {
      console.info(`\n\n==========> Running "${testName}"\n\n`);
      await testCb(platform, testInfo);
    });
  }
}

export function bothPlatformsIt(args: Omit<MobileItArgs, 'platform'>) {
  // Define test for Android
  mobileIt({ platform: 'android', ...args });

  // Define test for iOS
  mobileIt({ platform: 'ios', ...args });
}

export function bothPlatformsItSeparate(
  args: Omit<MobileItArgs, 'platform' | 'testCb' | 'shouldSkip'> & {
    ios: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
    android: Pick<MobileItArgs, 'shouldSkip' | 'testCb'>;
  }
) {
  // Define test for Android
  mobileIt({ platform: 'android', ...omit(args, ['ios', 'android']), ...args.android });

  // Define test for iOS
  mobileIt({ platform: 'ios', ...omit(args, ['ios', 'android']), ...args.ios });
}
