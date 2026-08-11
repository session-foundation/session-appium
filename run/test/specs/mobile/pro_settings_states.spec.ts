import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { CTAButtonNegative } from '../../locators/global';
import {
  ProBadgeSettingRow,
  ProFeaturesHeader,
  ProManageSectionHeader,
  ProPlanExpiry,
  ProRenewPlanRow,
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
 * Session Pro settings screens, driven by mocked launch arguments — no entitlement and no store. Each
 * state below is otherwise unreachable in a test: `active` needs a real subscription, `expired` needs
 * one that has lapsed, and the loading/error banners need the backend to be slow or down.
 *
 * Nothing here asserts a cryptographic outcome, so none of it needs a real *grant* — see the
 * mock-vs-backend split.
 *
 * **But "mocked" does not mean "backend-free", and on Android it never did.** The debug override
 * replaces only the displayed *type*; `refreshState` still comes from a real `get_pro_status`, and
 * `Success` requires `LoadState.Loaded` **and** `confirmedInThisProcess` (`ProStatusManager.kt:237`,
 * `:119-144`). The Expired CTA is gated on that success (`HomeViewModel.kt:251`), so these specs have a
 * live dependency on the local Pro backend being reachable with a **current** `TEST_PRO_BACKEND_ED_PK`.
 * A stale key does not fail loudly — the client reads every proof as invalid and silently strips Pro
 * content, so the CTA simply never appears and this file fails looking exactly like an app bug. Check
 * the key before believing a red here.
 *
 * The iOS mocks are a different shape and worth not conflating: they override the projected
 * `SessionPro.State`, while the startup status gate on the refresh-unification branch reads *libSession
 * config* (`proAccessExpiryTimestampSeconds`, `proConfig?.proProof`), which no mock writes. A fixture
 * user therefore skips that fetch entirely, so nothing in this file can speak to that behaviour.
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

bothPlatformsIt({
  title: 'Pro status checking state',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: proStatusChecking,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

bothPlatformsIt({
  title: 'Pro status error state',
  risk: 'low',
  countOfDevicesNeeded: 1,
  testCb: proStatusError,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
});

async function openAppAsNewUser(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iosContext: IOSTestContext
) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });
  return device;
}

async function openSettingsAsNewUser(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iosContext: IOSTestContext
) {
  const device = await openAppAsNewUser(platform, testInfo, iosContext);
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

/**
 * The **expired** state, in the order the app actually produces it: the CTA on app open, then the Pro
 * settings screen behind it with the renew action in place of the update-plan row.
 *
 * The CTA is asserted **at app open, before any navigation** — not after tapping into Pro settings,
 * which is what an earlier version of this spec did. That version had it backwards: it inferred the CTA
 * was what the Pro entry point opens, when it is app-open behaviour that happens to still be on screen
 * by the time a spec navigates. On Android it is not merely early, it *blocks* the route to settings —
 * the tap on User settings fails against the CTA's scrim — which is why the earlier shape could never
 * have passed there.
 *
 * Dismissing it is therefore a step of the spec, not incidental cleanup: the settings screen is
 * unreachable until it is gone.
 *
 * `ProStatsHeader` and `ProManageSectionHeader` are absent by design — both platforms gate those
 * sections on the plan being *active*, so asserting them here would assert a bug.
 */
async function proSettingsExpired(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openAppAsNewUser(platform, testInfo, {
    sessionProEnabled: 'true',
    proBackendStatus: 'expired',
  });

  await test.step('Verify the expiry CTA on app open', async () => {
    await device.checkCTA('proExpired');
    // Dismissed through its own Cancel button rather than `dismissCTA()`, which falls back to a
    // tap at (150,150). That tap does not dismiss this modal on iOS, and the *next* tap then lands
    // on the CTA's scrim — so navigation silently does nothing and the failure surfaces two steps
    // later as a missing `pro-menu-item`.
    await device.clickOnElementAll(new CTAButtonNegative(device));
  });

  await test.step('Open Pro settings', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  await test.step('Verify the expired Pro settings screen', async () => {
    await device.waitForTextElementToBePresent(new ProRenewPlanRow(device));
    await device.waitForTextElementToBePresent(new ProFeaturesHeader(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * `Pro status checking state` and `Pro status error state` were iOS-only until 2026-08-11, on two stated
 * grounds — and **only one of them was ever true**.
 *
 * The claim that Android's loading/error mocks are gated on the Pro state being forced was simply wrong:
 * `proDataRefreshState` is computed *before* the `forceCurrentUserAsPro` branch and passed through in the
 * non-forced path (`ProStatusManager.kt:126-155`), so `proLoadingState` applies to a never-subscribed
 * user exactly as these specs need. That error kept the pair parked for weeks.
 *
 * The real blocker was narrower than "no id": the banner already rendered, but `extraHeaderContent` sat
 * inside a `clearAndSetSemantics` subtree (`ProComponents.kt`), which **erases** descendants rather than
 * merging them — so neither an id nor the message text existed in the tree, and no locator of any shape
 * could have worked. Fixed by narrowing that call to the decorative logo/badge only, which also stopped
 * TalkBack announcing "Session Pro" over a status message users never heard.
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
