import { LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';

/**
 * The Session Pro settings screen in each of its four states, driven by mocked launch env. Each state
 * is otherwise unreachable: `active` needs a real subscription, `expired` one that has lapsed, and
 * the banners need the backend slow or down. Nothing here needs a real grant.
 *
 * Each spec asserts the **absence** of the other state's rows as well as the presence of its own —
 * that is what distinguishes the screens, so presence alone would pass an app rendering both.
 *
 * Unlike iOS and Android there is **no app-open CTA** here: `handleTriggeredCTAs` returns early when
 * `fromAppStart` is true and fires off a stored flag, so no status mock can produce it. Raised as a
 * product divergence rather than worked around.
 */

/** Matches the mobile specs' constant, and the app's `P30D` slug, so one string is asserted everywhere. */
const ACCESS_DAYS = 30;

test_Alice_1W(
  'Pro settings screen (subscribed)',
  async ({ alice }) => {
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);

    await alice.waitForElement({ locator: ProSettings.statsHeader });
    await alice.waitForElement({ locator: ProSettings.manageHeader });
    await alice.waitForElement({ locator: ProSettings.featuresHeader });
    await alice.waitForElement({ locator: ProSettings.badgeRow });
    await alice.waitForElement({
      locator: ProSettings.planExpiry,
      options: { text: tStripped('proExpiringTime', { time: `${ACCESS_DAYS} days` }) },
    });

    await alice.hasElementPoppedUpThatShouldnt(ProSettings.renewPlanButton);
  },
  { pro: { proBackendStatus: 'active', proAccessExpiry: 'P30D' } }
);

test_Alice_1W(
  'Pro settings screen (expired)',
  async ({ alice }) => {
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);

    await alice.waitForElement({ locator: ProSettings.renewPlanButton });
    await alice.waitForElement({ locator: ProSettings.featuresHeader });

    // Gated on the plan being active on every platform, so their presence here would be a bug.
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.statsHeader);
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.planExpiry);
  },
  { pro: { proBackendStatus: 'expired' } }
);

/**
 * The status banner in both non-success states, for a never-subscribed user — which is what lets
 * these run without a Pro fixture, and selects the non-Pro wording of each message.
 *
 * Matched with its text, never by id alone: the wrapper renders in every state including success
 * (empty), so a bare presence assertion cannot fail.
 */
test_Alice_1W(
  'Pro status checking state',
  async ({ alice }) => {
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);

    await alice.waitForElement({
      locator: ProSettings.statusBanner,
      options: { text: tStripped('checkingProStatus') },
    });
    await alice.waitForElement({ locator: ProSettings.featuresHeader });
  },
  { pro: { proBackendStatus: 'never', proLoadingState: 'loading' } }
);

test_Alice_1W(
  'Pro status error state',
  async ({ alice }) => {
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);

    await alice.waitForElement({
      locator: ProSettings.statusBanner,
      options: { text: tStripped('errorCheckingProStatus') },
    });
    await alice.waitForElement({ locator: ProSettings.featuresHeader });
  },
  { pro: { proBackendStatus: 'never', proLoadingState: 'error' } }
);

/**
 * The acknowledgement a subscriber gets where a non-Pro user would see the animated-DP upsell.
 * Reached through the Pro badge in the edit-profile-picture modal, which resolves to whichever
 * variant fits the account — no animated image needed, so it needs no picker file.
 */
test_Alice_1W(
  'Pro Activated CTA',
  async ({ alice }) => {
    await alice.subscribeToPro();
    // Desktop asks the backend for status only at startup, so the grant is invisible until restart.
    await restartApp(alice, { pro: {} });
    await alice.waitForProActive();

    await alice.openAnimatedDisplayPictureCTA();
    await alice.checkCTA('alreadyActivated');
  },
  { pro: {} }
);
