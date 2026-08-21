import { test } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import {
  ProBadgeSettingRow,
  ProCancelPlanRow,
  ProFaqRow,
  ProFeaturesHeader,
  ProRequestRefundRow,
  ProScreen,
  ProScreenDescription,
  type ProScreenId,
  type ProStat,
  ProStatCell,
  ProStatsHeader,
  ProSupportRow,
} from '../locators/pro';

/**
 * Waits, chosen so a genuine miss fails fast rather than burning the 60s default.
 *
 * `PRESENT` is for elements that should already be on a settled screen — the navigation that got us here
 * has completed, so ten seconds is slack for a loaded simulator rather than time for something to arrive.
 * `ABSENT` only ever bounds the negative case: a present element returns as soon as it is found, so this
 * is purely how long we are willing to wait before believing something is missing.
 */
const PRESENT_MAX_WAIT = 10_000;
const ABSENT_MAX_WAIT = 1_000;

/**
 * Each stat cell with the copy it should carry on a fixture that has never used a Pro feature.
 *
 * Zero rather than a wildcard because the count is the point: a client that rendered the matrix but wired
 * the wrong counter would still satisfy a presence-only assertion.
 */
const PRO_STATS: ReadonlyArray<{ stat: ProStat; expected: string }> = [
  {
    stat: 'longer-messages',
    expected: tStripped('proLongerMessagesSent', { count: 0, total: '0' }),
  },
  {
    stat: 'pinned-conversations',
    expected: tStripped('proPinnedConversations', { count: 0, total: '0' }),
  },
  { stat: 'badges-sent', expected: tStripped('proBadgesSent', { count: 0, total: '0' }) },
  { stat: 'groups-upgraded', expected: tStripped('proGroupsUpgraded', { count: 0, total: '0' }) },
];

/**
 * Scroll to the bottom of the Pro settings screen.
 *
 * Load-bearing before any absence assertion about the manage section: it starts off screen, and an
 * off-screen element is absent from the accessibility tree, so the assertion would pass regardless of
 * what the client rendered. Bounded rather than keyed on the element under test, which would hide that
 * failure.
 */
export async function scrollToProSettingsBottom(device: DeviceWrapper): Promise<void> {
  const maxScrolls = 6;
  for (let i = 0; i < maxScrolls; i++) {
    const atBottom = await device.doesElementExist({
      ...new ProSupportRow(device).build(),
      maxWait: ABSENT_MAX_WAIT,
    });
    if (atBottom) {
      return;
    }
    await device.scrollDown();
  }
  // Fatal on purpose: callers assert absence after this.
  await device.waitForTextElementToBePresent({
    ...new ProSupportRow(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });
}

/**
 * The "Your Pro Stats" matrix — header and all four cells, each with its expected copy.
 *
 * The cells matter as much as the header: a client that dropped the matrix but kept the heading would
 * satisfy a header-only assertion, and the designs keep all four through every active state including a
 * pending refund.
 *
 * The copy is asserted on iOS only — see `ProStatCell` for why Android has nothing to match it against.
 */
export async function expectProStatsMatrix(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the Pro stats matrix', async () => {
    await Promise.all([
      device.waitForTextElementToBePresent({
        ...new ProStatsHeader(device).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
      ...PRO_STATS.map(({ stat, expected }) =>
        device.waitForTextElementToBePresent({
          ...new ProStatCell(device, stat, expected).build(),
          maxWait: PRESENT_MAX_WAIT,
        })
      ),
    ]);
  });
}

/**
 * The help section, which every Pro settings state keeps.
 *
 * Worth its own assertion rather than being left to `scrollToProSettingsBottom`, which only uses the
 * support row as an anchor: if the section disappeared, the anchor would fail as "could not reach the
 * bottom" rather than saying what was actually missing.
 *
 * The copy is asserted on Android only — both rows have a subtitle, and iOS merges it into the label.
 */
export async function expectProHelpSection(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the help section', async () => {
    // Scrolls itself: the help section is the last thing on the screen, so on arrival it is off screen
    // and therefore absent from the accessibility tree. Cheap when already at the bottom.
    await scrollToProSettingsBottom(device);
    await Promise.all([
      device.waitForTextElementToBePresent({
        ...new ProFaqRow(device, tStripped('proFaq')).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
      device.waitForTextElementToBePresent({
        ...new ProSupportRow(device, tStripped('helpSupport')).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
    ]);
  });
}

/**
 * Everything an active plan shows besides the manage actions: the stats matrix, the badge row and the
 * features section.
 *
 * Grouped because these travel together — the point of asserting them is that a state which withdraws
 * the *plan controls* leaves the feature surface alone, and each on its own is a weaker version of that
 * claim. Assert it in both the withdrawn and offered cases so the contrast is about the controls rather
 * than about which sections a fixture happens to render at all.
 */
export async function expectProFeatureSurface(device: DeviceWrapper): Promise<void> {
  await expectProStatsMatrix(device);
  await test.step('Verify the Pro badge row', async () => {
    await device.waitForTextElementToBePresent({
      ...new ProBadgeSettingRow(device).build(),
      maxWait: PRESENT_MAX_WAIT,
    });
  });
  await expectProFeaturesSection(device);
}

/** The "Pro Beta Features" section, which is present whenever the plan is active. */
export async function expectProFeaturesSection(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the Pro features section', async () => {
    await device.waitForTextElementToBePresent({
      ...new ProFeaturesHeader(device).build(),
      maxWait: PRESENT_MAX_WAIT,
    });
  });
}

/**
 * The manage section's actions, asserted absent.
 *
 * Scrolls first, for the reason on `scrollToProSettingsBottom`. Both rows are withdrawn by the same
 * branch, but cancel cannot carry the claim alone: it is also gated on the plan renewing itself, and on
 * iOS on a confirmed status fetch, so a fixture supplying neither has no cancel row to lose.
 */
export async function expectManageActionsWithdrawn(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the manage actions are withdrawn', async () => {
    await scrollToProSettingsBottom(device);
    await Promise.all([
      device.verifyElementNotPresent({
        ...new ProRequestRefundRow(device).build(),
        maxWait: ABSENT_MAX_WAIT,
      }),
      device.verifyElementNotPresent({
        ...new ProCancelPlanRow(device).build(),
        maxWait: ABSENT_MAX_WAIT,
      }),
    ]);
  });
}

/**
 * The manage section's actions, asserted present with their copy — the counterpart to
 * `expectManageActionsWithdrawn`.
 *
 * Both rows need `proAutoRenewing: 'autoRenewing'`, and cancel additionally needs
 * `proLoadingState: 'success'` on iOS, which is what satisfies its confirmed-fetch gate. Without those
 * the cancel half of this and of `expectManageActionsWithdrawn` asserts nothing.
 */
export async function expectManageActionsOffered(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the manage actions are offered', async () => {
    await scrollToProSettingsBottom(device);
    await Promise.all([
      device.waitForTextElementToBePresent({
        ...new ProRequestRefundRow(device, tStripped('requestRefund')).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
      device.waitForTextElementToBePresent({
        ...new ProCancelPlanRow(device, tStripped('cancelAccess')).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
    ]);
  });
}

/**
 * Open the refund flow from the Pro settings screen and assert which screen it lands on.
 *
 * The screen id alone is not enough: the different-account, <48h and >48h variants are all the same
 * content view, so they share `pro-screen-refund-plan-non-originating` and are told apart only by their
 * body copy. Both are asserted together for that reason.
 */
export async function expectRefundScreen(
  device: DeviceWrapper,
  screen: ProScreenId,
  description: string
): Promise<void> {
  await test.step(`Open the refund flow and verify ${screen}`, async () => {
    await scrollToProSettingsBottom(device);
    await device.clickOnElementAll(new ProRequestRefundRow(device));
    await Promise.all([
      device.waitForTextElementToBePresent({
        ...new ProScreen(device, screen).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
      device.waitForTextElementToBePresent({
        ...new ProScreenDescription(device, description).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
    ]);
  });
}
