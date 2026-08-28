import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ProSettingsEntry, ProStatsHeader } from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { activeProContext } from '../../utils/pro_context';

/**
 * The warning a subscriber gets as their access approaches its end — the one thing standing between
 * someone who meant to renew and someone who silently lapses.
 *
 * Mocked rather than granted, because the subject is what the client *shows* and where: a subscriber
 * is warned on the launch that finds them expiring, with no detour through settings first. Whether the
 * client was right to trust the state it warned off is the fetch gate's business, and
 * `pro_startup_fetch_gate` covers that against a real grant with no mocks at all.
 *
 * `proLoadingState: 'success'` is load-bearing on both platforms: the CTA arms only on a status fetch
 * confirmed in this process, which a mocked expiry alone does not provide.
 */

/**
 * Days of remaining access the fixture aims for. Every client warns inside a seven-day window, so two
 * days is comfortably inside it without sitting so close to the boundary that a slow run could cross
 * it.
 */
const EXPIRING_SOON_DAYS = 2;

bothPlatformsIt({
  title: 'Pro expiring soon CTA',
  risk: 'high',
  countOfDevicesNeeded: 1,
  testCb: proExpiringSoonCTA,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A subscriber whose access is about to end is warned on app open, and can dismiss the warning ' +
    'and still reach an active Pro settings screen.',
});

async function proExpiringSoonCTA(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, {
      ...activeProContext(EXPIRING_SOON_DAYS),
      proLoadingState: 'success',
    });
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Verify the expiring-soon CTA on app open', async () => {
    await device.checkCTA('proExpiringSoon');
    await device.dismissCTA('negativeButton');
  });

  await test.step('Verify the plan is still active behind it', async () => {
    // The warning is about access ENDING, not access ended: dismissing it must leave a subscriber
    // looking like a subscriber, and the stats section is gated on the plan being active.
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    await device.waitForTextElementToBePresent(new ProStatsHeader(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
