import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt, iosIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import {
  ProBadgeSettingRow,
  ProFeaturesHeader,
  ProManageSectionHeader,
  ProPlanExpiry,
  ProSettingsEntry,
  ProStatsHeader,
  ProStatusBanner,
  UpdateProAccessRow,
} from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { IOSTestContext } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';

/**
 * Session Pro settings screens, driven entirely by mocked launch arguments — no Pro backend, no
 * entitlement, and no store. Each state below is otherwise unreachable in a test: `active` needs a
 * real subscription, `expired` needs one that has lapsed, and the loading/error banners need the
 * backend to be slow or down.
 *
 * Nothing here asserts a cryptographic outcome, so none of it wants a real backend even though one
 * is available — see the mock-vs-backend split. That is what makes these the cheapest Pro specs in
 * the suite.
 *
 * Cross-platform via the shared `ProMockContext` fields: iOS reads them as launch-arg env, Android as
 * intent extras that `QaLaunchConfig` writes to the preferences its debug menu already drives. Only
 * `proBackendStatus` and `proLoadingState` cross over — `sessionProEnabled` and `proAccessExpiry` are
 * iOS-specific and are ignored on Android, which reaches the same states through its own fixtures.
 */

/**
 * Whole days of remaining access the `active` cases render.
 *
 * Both platforms ceiling the remaining interval into day/hour/minute units, so an expiry exactly N
 * days out renders as `N days` for the whole first day — deterministic however long onboarding took.
 *
 * 30 is a **shared constant, not an iOS choice**: iOS takes the expiry as a timestamp while Android
 * uses a fixed debug offset (`EXPIRING_LATER_DAYS` in `ProStatusManager`), and that offset was moved
 * from 40 to 30 so a single `bothPlatformsIt` spec can assert one rendered string. Changing it here
 * means changing it there.
 */
const ACCESS_DAYS = 30;
const accessExpiry = () => String(Math.floor(Date.now() / 1000) + ACCESS_DAYS * 24 * 60 * 60);

bothPlatformsIt({
  title: 'Pro settings screen (subscribed)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proSettingsSubscribed,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

bothPlatformsIt({
  title: 'Pro settings entry (expired)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proSettingsExpired,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

iosIt({
  title: 'Pro status checking state',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: proStatusChecking,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

iosIt({
  title: 'Pro status error state',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: proStatusError,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

async function openSettingsAsNewUser(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iosContext: IOSTestContext
) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  await device.clickOnElementAll(new UserSettings(device));
  return device;
}

async function proSettingsSubscribed(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openSettingsAsNewUser(platform, testInfo, {
    sessionProEnabled: 'true',
    proBackendStatus: 'active',
    proAccessExpiry: accessExpiry(),
  });

  await test.step('Open Pro settings', async () => {
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  await test.step('Verify the subscribed Pro settings screen', async () => {
    await device.waitForTextElementToBePresent(new ProStatsHeader(device));
    await device.waitForTextElementToBePresent(new ProManageSectionHeader(device));
    await device.waitForTextElementToBePresent(new UpdateProAccessRow(device));
    await device.waitForTextElementToBePresent(new ProPlanExpiry(device, `${ACCESS_DAYS} days`));
    await device.waitForTextElementToBePresent(new ProBadgeSettingRow(device));
    await device.waitForTextElementToBePresent(new ProFeaturesHeader(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proSettingsExpired(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openSettingsAsNewUser(platform, testInfo, {
    sessionProEnabled: 'true',
    proBackendStatus: 'expired',
  });

  // An expired subscription does not open the Pro settings screen at all — the entry point goes
  // straight to the renewal CTA, which is the behaviour worth pinning here.
  await test.step('Open the expired Pro entry', async () => {
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  await test.step('Verify the renewal CTA', async () => {
    await device.checkCTA('proExpired');
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * `Pro status checking state` and `Pro status error state` are **iOS-only until Android catches up**,
 * for two independent reasons found when they were first ported:
 *
 * 1. Android has no `pro-settings-status-banner` — the id does not exist in the app, so there is
 *    nothing for the locator to match whatever state the screen is in.
 * 2. Android's loading/error mocks are gated on the Pro state being forced. `proBackendStatus:
 *    'never'` leaves that gate false, so `proLoadingState` never applies — while on iOS the two are
 *    independent and these banners are reachable for a non-Pro user.
 *
 * Both are Android-side; nothing here needs changing when they land. The other two specs in this file
 * are cross-platform already.
 */
async function proStatusChecking(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openSettingsAsNewUser(platform, testInfo, {
    sessionProEnabled: 'true',
    proBackendStatus: 'never',
    proLoadingState: 'loading',
  });

  await test.step('Open Pro settings', async () => {
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  await test.step('Verify the checking-status banner', async () => {
    await device.waitForTextElementToBePresent(new ProStatusBanner(device, 'checking'));
    await device.waitForTextElementToBePresent(new ProFeaturesHeader(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proStatusError(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openSettingsAsNewUser(platform, testInfo, {
    sessionProEnabled: 'true',
    proBackendStatus: 'never',
    proLoadingState: 'error',
  });

  await test.step('Open Pro settings', async () => {
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  await test.step('Verify the backend-unavailable banner', async () => {
    await device.waitForTextElementToBePresent(new ProStatusBanner(device, 'error'));
    await device.waitForTextElementToBePresent(new ProFeaturesHeader(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
