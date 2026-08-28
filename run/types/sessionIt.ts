import { test, type TestInfo } from '@playwright/test';
import { omit } from 'lodash';

import type { AppCountPerTest } from '../test/state_builder';

import { setupAllureTestInfo } from '../test/utils/allure/allureHelpers';
import {
  allocateCommunityRooms,
  perTestRoomsEnabled,
  releaseCommunityRooms,
} from '../test/utils/community_rooms';
import { unregisterDevicesForTest } from '../test/utils/device_registry';
import { resolveNetworkTarget } from '../test/utils/devnet';
import {
  captureLogsOnFailure,
  capturePageSourceOnFailure,
  captureScreenshotsOnFailure,
} from '../test/utils/failure_artifacts';
import { getServiceNetwork } from '../test/utils/network_target';
import { SupportedPlatformsType } from '../test/utils/open_app';
import { AllureSuiteConfig } from './allure';
import { ServiceNetwork } from './target';
import { TestRisk } from './testing';

// Test wrapper configuration
type MobileItArgs = {
  platform: SupportedPlatformsType;
  countOfDevicesNeeded: AppCountPerTest;
  title: string;
  risk: TestRisk;
  testCb: (platform: SupportedPlatformsType, testInfo: TestInfo) => Promise<void>;
  shouldSkip?: boolean;
  /**
   * The service network this test's fixtures only exist on.
   *
   * For a test whose subject is registered on one network and nowhere else — an ONS name is the case
   * this exists for — running anywhere else asserts something that cannot be true. That is not a flake
   * and not a defect, so it is skipped with the reason named rather than left as a permanent red that
   * everyone learns to scroll past.
   *
   * Declared rather than checked inside the test, so the constraint is visible in the run output and in
   * the file, and so the gap it leaves is countable.
   */
  requiresNetwork?: ServiceNetwork;
  isPro?: boolean;
  /**
   * How many community rooms this test needs. Against a local SOGS the rooms are created for this
   * test alone and deleted afterwards, so the test can leave them in any state it likes. Reading
   * `communities` without declaring this throws — see constants/community.ts.
   */
  communityRooms?: number;
  allureSuites?: AllureSuiteConfig;
  allureDescription?: string;
  allureLinks?: {
    all?: string[] | string;
    android?: string[] | string;
    ios?: string[] | string;
  };
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
  requiresNetwork,
  isPro = false,
  countOfDevicesNeeded,
  communityRooms,
  allureSuites,
  allureDescription,
  allureLinks,
}: MobileItArgs) {
  const proTag = isPro ? ' @pro' : '';
  const testName = `${title} @${platform} @${risk ?? 'default'}-risk @${countOfDevicesNeeded}-devices${proTag}`;

  const networkInUse = getServiceNetwork();
  const wrongNetwork = requiresNetwork !== undefined && requiresNetwork !== networkInUse;

  if (shouldSkip || wrongNetwork) {
    const reason = wrongNetwork
      ? `it needs ${requiresNetwork} and this run is on ${networkInUse}`
      : 'it is marked shouldSkip';
    // Logged at declaration as well as annotated: the annotation reaches Allure, but the local
    // reporter prints only the status, so without this a skipped spec is indistinguishable from one
    // that silently stopped being collected.
    console.info(`==========> Skipping "${testName}" — ${reason}`);

    // The reason is given to `test.skip` from inside the body rather than logged from a
    // `test.skip(title, fn)` callback, which Playwright never runs — so a skip used to arrive with no
    // stated cause, and a reader could not tell a deliberate skip from a lost one.
    test(testName, () => {
      test.skip(true, reason);
    });
    return;
  }

  // eslint-disable-next-line no-empty-pattern
  test(testName, async ({}, testInfo) => {
    await resolveNetworkTarget([platform]);
    console.info(`\n\n==========> Running "${testName}"\n\n`);

    // Handle Suites, Descriptions and Links
    await setupAllureTestInfo({
      suites: allureSuites,
      description: allureDescription,
      links: allureLinks,
      platform,
    });

    let testFailed = false;

    if (communityRooms && perTestRoomsEnabled()) {
      try {
        await allocateCommunityRooms(communityRooms);
      } catch (allocationError) {
        // Allocation sits outside the try below, so its `finally` — where rooms are released — is not
        // reached if allocation itself fails. A partly-completed allocation has still created rooms,
        // so release them here rather than leaving them for the gc TTL.
        await releaseCommunityRooms();
        throw allocationError;
      }
    }

    try {
      await testCb(platform, testInfo);

      // If the test passed but used healing, fail loudly to be identified in the allure report
      const healedAnnotations = testInfo.annotations.filter(a => a.type === 'healed');
      if (healedAnnotations.length > 0) {
        // Deduplicate and sort for consistent error messages
        const uniqueHealings = [...new Set(healedAnnotations.map(a => a.description))];
        uniqueHealings.sort();

        const details = uniqueHealings.join('\n');
        throw new Error(`Test passed but used healed locators:\n${details}`);
      }
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
          await capturePageSourceOnFailure(testInfo);
          await captureLogsOnFailure(testInfo);
        }
      } catch (artifactError) {
        console.error('Failed to capture failure artifacts:', artifactError);
      }

      try {
        unregisterDevicesForTest(testInfo);
      } catch (cleanupError) {
        console.error('Failed to unregister devices:', cleanupError);
      }

      // Anything missed here (timeouts and interrupts skip this block, per the note above) is
      // collected by the gc sweep in global-setup.
      try {
        await releaseCommunityRooms();
      } catch (cleanupError) {
        console.error('Failed to release community rooms:', cleanupError);
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
