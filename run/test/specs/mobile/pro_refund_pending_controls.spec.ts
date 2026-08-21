import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import {
  ProPlanAutoRenewal,
  ProRefundProcessingSubtitle,
  ProSettingsEntry,
  ProUpdatePlanRowTitle,
} from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import {
  IOS_PRO_ACCESS_DAYS,
  iosActiveProContext,
  IOSTestContext,
} from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import {
  expectManageActionsOffered,
  expectManageActionsWithdrawn,
  expectProFeatureSurface,
  expectProHelpSection,
} from '../../utils/pro_settings';

/**
 * What the Pro settings screen offers an active subscriber once a refund has been requested.
 *
 * The claim is that requesting a refund withdraws every control that would *change* the subscription —
 * the refund and cancel actions go, and the update-plan row becomes read-only — while the stats, badge
 * and feature sections stay. Those are separate branches in the client, so checking one says nothing
 * about the other.
 *
 * Both platforms keep one row and swap its title, so the title and subtitle carry that half of the claim
 * rather than the row's id. `pro-settings-manage-header` is deliberately not asserted: it sits on the
 * settings section, which survives a pending refund, not on the manage section, which does not.
 */
bothPlatformsIt({
  title: 'Pro settings screen (refund pending)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proSettingsRefundPending,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A subscriber with a refund in flight is offered no way to update, cancel or re-refund the plan, ' +
    'while the Pro feature surface stays in place.',
});

/**
 * The same fixture with the one mock flipped, which is what makes the assertions above mean anything:
 * every row asserted absent there is asserted present here, so neither a client that stopped rendering
 * the manage section nor a mock that stopped being applied can leave both specs green.
 *
 * `ProCancelPlanRow` is not asserted present: it also needs the subscriber to be auto-renewing with a
 * confirmed fetch, which a display mock does not supply.
 *
 * This pins the **auto-renewing** subtitle. The row has four states in all: auto-renewing, renewal
 * unsuccessful (auto-renewing with the renewal overdue), expiring, and refunding. `proExpiringTime` is
 * covered by `pro_settings_states`; the renewal-unsuccessful state needs an access expiry in the past
 * alongside `proAutoRenewing` and has no spec yet.
 *
 */
bothPlatformsIt({
  title: 'Pro settings screen (no refund pending)',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: proSettingsNoRefundPending,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'The control for the refund-pending screen: the same active subscriber, with the plan controls in ' +
    'place.',
});

/**
 * The provider whose name the refund subtitle interpolates. Each client reports the store it was bought
 * through, and these fixtures buy on the device under test.
 */
function refundProviderToken(platform: SupportedPlatformsType) {
  return platform === 'ios'
    ? 'pro_provider_app_store_platform'
    : 'pro_provider_google_play_platform';
}

async function openProSettings(
  platform: SupportedPlatformsType,
  testInfo: TestInfo,
  iosContext: IOSTestContext
) {
  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo, iosContext);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step('Open Pro settings', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
  });

  return device;
}

async function proSettingsRefundPending(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(platform, testInfo, {
    ...iosActiveProContext(),
    proRefundingStatus: 'refunding',
    // Both load-bearing for the cancel assertion in `expectManageActionsWithdrawn`: a plan that never
    // renewed has no cancel action to withdraw, and iOS additionally gates that row on a confirmed
    // status fetch. Without them that half asserts nothing.
    proAutoRenewing: 'autoRenewing',
    proLoadingState: 'success',
  });

  await test.step('Verify the update-plan row is read-only', async () => {
    await device.waitForTextElementToBePresent(
      new ProUpdatePlanRowTitle(device, tStripped('proRequestedRefund'))
    );
    // The subtitle too: the title is a static string, this interpolates a provider name resolved at
    // runtime, and they fail independently.
    await device.waitForTextElementToBePresent(
      new ProRefundProcessingSubtitle(device, tStripped(refundProviderToken(platform)))
    );
  });

  // Everything a refund does NOT take away. The designs keep all of it through a pending refund, so
  // each of these would be a regression rather than an omission.
  await expectProFeatureSurface(device);

  await expectManageActionsWithdrawn(device);
  await expectProHelpSection(device);

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

async function proSettingsNoRefundPending(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(platform, testInfo, {
    ...iosActiveProContext(),
    proRefundingStatus: 'notRefunding',
    proAutoRenewing: 'autoRenewing',
    // Load-bearing for the expiry line below: until a status fetch confirms, the subtitle reads
    // "Pro access loading..." rather than the remaining access, so without this the assertion depends on
    // whether the Pro backend happened to answer in time.
    proLoadingState: 'success',
  });

  // The same row asserted the other way round, so a client stuck on one title cannot pass both specs.
  await test.step('Verify the update-plan row offers the renewing plan', async () => {
    await device.waitForTextElementToBePresent(
      new ProUpdatePlanRowTitle(device, tStripped('updateAccess'))
    );
    // The subtitle too, so both halves of the row are pinned in both states: the remaining access here,
    // the processing notice in the refunding case. Read from the same constant the fixture sets its
    // expiry from, so the assertion and the fixture cannot drift apart.
    await device.waitForTextElementToBePresent(
      new ProPlanAutoRenewal(device, `${IOS_PRO_ACCESS_DAYS} days`)
    );
  });

  // The same surface the refund-pending spec asserts, so that assertion is about a refund withdrawing
  // the plan controls rather than about which sections this fixture happens to render at all.
  await expectProFeatureSurface(device);

  await expectManageActionsOffered(device);

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
