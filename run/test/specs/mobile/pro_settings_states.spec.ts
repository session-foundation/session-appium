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
 * **"Mocked" does not mean "backend-free" on Android.** The debug override replaces only the displayed
 * *type*; `refreshState` still comes from a real `get_pro_status`, and reaching `Success` requires a
 * fetch that confirms in-process. The Expired CTA is gated on that success, so this file has a live
 * dependency on the local Pro backend being reachable with a **current** `TEST_PRO_BACKEND_ED_PK`. A
 * stale key does not fail loudly — the client reads every proof as invalid and silently strips Pro
 * content, so the CTA never appears and these specs fail looking exactly like an app bug. Check the key
 * before believing a red here.
 *
 * **No mock in this file writes libSession config.** They override the projected Pro state only, so a
 * fixture user has no access expiry and no proof as far as config is concerned. Anything the client
 * gates on *config* rather than on displayed state is therefore unreachable from here, and a spec that
 * appears to exercise it is passing for another reason.
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
 * **The CTA is app-open behaviour, not a consequence of opening Pro settings.** It fires before any
 * navigation and is merely still on screen by the time a spec reaches settings, so asserting it after
 * the tap would pass for the wrong reason. Assert it where it happens.
 *
 * Dismissing it is a step of the spec, not incidental cleanup: on Android the CTA's scrim swallows the
 * tap on User settings, so the settings screen is unreachable until the CTA is gone.
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
 * The status banner, in both of its non-success states.
 *
 * `proLoadingState` applies to a **never-subscribed** user, which is what lets these two run without a
 * Pro fixture: Android computes `proDataRefreshState` before the `forceCurrentUserAsPro` branch and
 * passes it through the non-forced path, so forcing Pro is not a precondition for reaching Loading or
 * Error.
 *
 * The banner is drawn inside `SessionProSettingsHeader`'s `extraContent`, and that header applies
 * `clearAndSetSemantics` to its decorative logo and badge. **That call must stay narrow** — widening it
 * back over `extraContent` erases descendants rather than merging them, which removes the banner's id
 * *and its text* from the tree, defeating any locator, and mutes the message for TalkBack.
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
