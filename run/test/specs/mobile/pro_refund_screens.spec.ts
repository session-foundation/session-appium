import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { TestSteps } from '../../../types/allure';
import { androidIt, bothPlatformsIt, iosIt } from '../../../types/sessionIt';
import { USERNAME } from '../../../types/testing';
import { ProSettingsEntry } from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { iosActiveProContext, IOSTestContext } from '../../utils/capabilities_ios';
import { newUser } from '../../utils/create_account';
import {
  closeApp,
  openAppOnPlatformSingleDevice,
  SupportedPlatformsType,
} from '../../utils/open_app';
import { expectRefundScreen } from '../../utils/pro_settings';

/**
 * Which refund screen each state opens.
 *
 * These are branch assertions, not purchases: the client decides between four screens from the
 * originating platform, whether the signed-in store account is the one that bought the plan, and whether
 * the store's own quick-refund window is still open. Every one of them is reachable by mock.
 *
 * All four share a title, and three of them share a screen id — they are the same content view rendered
 * with different copy. So each case asserts the screen id **and** the body copy; the id alone would pass
 * for three different states.
 *
 * A subscriber must be able to reach the refund action at all, which is why every fixture here is active,
 * renewing and holding a proof.
 */

/** Every fixture starts from a renewing subscriber whose status fetch has confirmed. */
function refundFixture(overrides: IOSTestContext): IOSTestContext {
  return {
    ...iosActiveProContext(),
    proAutoRenewing: 'autoRenewing',
    // The refund row is only offered once a fetch has confirmed on iOS.
    proLoadingState: 'success',
    ...overrides,
  };
}

bothPlatformsIt({
  title: 'Refund screen for a plan bought elsewhere',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundBoughtElsewhere,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A plan bought on the other platform opens the non-originating refund screen, naming the store it ' +
    'was bought through.',
});

/**
 * iOS-only because the same navigation reaches a different screen on Android: there the originating refund
 * screen is *two* states rather than one, split by the store's own refund window, and it words them with
 * different keys (`proRefundRequestStorePolicies` / `proRefundRequestSessionSupport`) than iOS's single
 * `proRefundingDescription`. Those two states are covered by the Android cases below.
 */
iosIt({
  title: 'Refund screen for the buying account',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundOriginatingAccount,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'The account that bought the plan is offered the refund directly, with the copy explaining the store ' +
    'owns the outcome.',
});

/**
 * Shared, but with each platform's own copy: both send a different store account to the non-originating
 * screen, and word it differently — iOS names the account (`refundNonOriginatorApple`), Android names the
 * store (`proPlanPlatformRefund`).
 *
 * Android only reached this state once `RefundPlanScreen` began consulting `hasValidSubscription`. It
 * previously branched on `isFromAnotherPlatform()` alone, so a same-platform/different-account plan opened
 * the *originating* screen and was offered a refund it could not complete.
 */
bothPlatformsIt({
  title: 'Refund screen for a different store account',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundDifferentAccount,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'A plan bought on a different store account of the same platform opens the non-originating screen ' +
    'that points at that account.',
});

/**
 * iOS-only because the window changes a different screen on each platform. Android's *non-originating*
 * refund screen has no reference to the window at all — there the window switches its **originating**
 * screen between the two refund routes, which is what `refundWithinStoreWindow` and
 * `refundOutsideStoreWindow` below cover. So there is no Android counterpart to this assertion.
 */
iosIt({
  title: 'Refund screen once the quick-refund window has closed',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundWindowClosed,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    "Past the store's own refund window the screen routes the request to Session Support instead of the " +
    'store website.',
});

/**
 * The two routes Android offers the buyer of a plan, split by the store's own refund window.
 *
 * Android-only for the reason on `refundOriginatingAccount`: iOS renders one screen here regardless of the
 * window, so there is nothing on that side to pair these with.
 */
androidIt({
  title: 'Refund screen inside the store refund window',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundWithinStoreWindow,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    "Inside the store's own refund window the buyer is sent to the store to request it.",
});

androidIt({
  title: 'Refund screen outside the store refund window',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  testCb: refundOutsideStoreWindow,
  isPro: true,
  allureSuites: { parent: 'Session Pro' },
  allureDescription:
    'Once that window has passed the same screen routes the request to Session Support instead.',
});

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

/**
 * Bought on the other platform, quick-refund window still open.
 *
 * The copy names the store rather than an account, which is what distinguishes this from the
 * different-account case below — the two screens are otherwise identical.
 */
async function refundBoughtElsewhere(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const otherPlatform = platform === 'ios' ? 'android' : 'iOS';
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      proOriginatingPlatform: otherPlatform,
      proQuickRefundWindow: 'open',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan-non-originating',
    tStripped('proPlanPlatformRefund', {
      platform_store: tStripped(
        platform === 'ios' ? 'pro_provider_google_play_store' : 'pro_provider_app_store_store'
      ),
      platform_account: tStripped(
        platform === 'ios' ? 'pro_provider_google_play_account' : 'pro_provider_app_store_account'
      ),
    })
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/** Bought on this platform, on the account that is signed in. */
async function refundOriginatingAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      proOriginatingPlatform: 'iOS',
      proOriginatingAccount: 'originatingAccount',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan',
    tStripped('proRefundingDescription', {
      platform: tStripped('pro_provider_app_store_platform'),
      platform_store: tStripped('pro_provider_app_store_store'),
    })
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/** Bought on this device's own platform, but on a different store account. */
async function refundDifferentAccount(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const onIOS = platform === 'ios';
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      // This device's own platform: the case is "same platform, different account", so anything else
      // would be testing the platform branch instead.
      proOriginatingPlatform: onIOS ? 'iOS' : 'android',
      proOriginatingAccount: 'nonOriginatingAccount',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan-non-originating',
    onIOS
      ? tStripped('refundNonOriginatorApple', {
          platform_account: tStripped('pro_provider_app_store_account'),
        })
      : tStripped('proPlanPlatformRefund', {
          platform_store: tStripped('pro_provider_google_play_store'),
          platform_account: tStripped('pro_provider_google_play_account'),
        })
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/**
 * Bought on the other platform, quick-refund window closed.
 *
 * The pair with `refundBoughtElsewhere`: same screen, same fixture but for the window, and the copy is
 * the only difference — which is what makes the window mock worth having.
 */
async function refundWindowClosed(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      proOriginatingPlatform: 'android',
      proQuickRefundWindow: 'closed',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan-non-originating',
    tStripped('proPlanPlatformRefundLong', {
      platform_store: tStripped('pro_provider_google_play_store'),
    })
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/** Bought on this device's own store, inside its refund window. */
async function refundWithinStoreWindow(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      proOriginatingPlatform: 'android',
      proOriginatingAccount: 'originatingAccount',
      proQuickRefundWindow: 'open',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan',
    tStripped('proRefundRequestStorePolicies', {
      platform: tStripped('pro_provider_google_play_platform'),
    })
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}

/** The pair with the above: same fixture, window closed, so the request goes to Session Support. */
async function refundOutsideStoreWindow(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const device = await openProSettings(
    platform,
    testInfo,
    refundFixture({
      proOriginatingPlatform: 'android',
      proOriginatingAccount: 'originatingAccount',
      proQuickRefundWindow: 'closed',
    })
  );

  await expectRefundScreen(
    device,
    'pro-screen-refund-plan',
    tStripped('proRefundRequestSessionSupport')
  );

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
