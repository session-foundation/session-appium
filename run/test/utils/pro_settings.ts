import { expect, test } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { CloseSettings } from '../locators';
import {
  OpenURLDialog,
  OpenURLDialogConfirmButton,
  OpenURLDialogDescription,
} from '../locators/global';
import {
  ProBadgeSettingRow,
  ProCancelPlanRow,
  ProFaqRow,
  ProFeaturesHeader,
  ProRequestRefundRow,
  ProScreen,
  ProScreenAction,
  ProScreenDescription,
  type ProScreenId,
  ProSettingsEntry,
  type ProStat,
  ProStatCell,
  ProStatsHeader,
  ProSupportRow,
} from '../locators/pro';
import { UserSettings } from '../locators/settings';

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
 * The copy a stat cell carries for a given count.
 *
 * A switch rather than a token lookup table because `tStripped` resolves its argument type from the
 * token, and a union of four tokens resolves to a union of four argument shapes that no single call
 * satisfies.
 *
 * Both platforms pass the number twice — once as the plural quantity and once as the substituted
 * `{total}` — so the singular form is only produced at exactly one. That is what makes an expected-copy
 * comparison at count 1 a real check rather than a spelling of the number: a client that hard-coded the
 * plural form renders "1 Pro Badges Sent" and fails.
 *
 * Only correct below 1000. Both platforms abbreviate above that (Android's `NumberUtil` renders `1.3k`;
 * iOS keeps `Int.description`, which is a divergence of its own), and the quantity is still chosen from
 * the raw number. Nothing here goes near that range, and `parseProStatCount` refuses a reading it cannot
 * reproduce rather than guessing.
 */
export function proStatCopy(stat: ProStat, total: number): string {
  const args = { count: total, total: String(total) };
  switch (stat) {
    case 'badges-sent':
      return tStripped('proBadgesSent', args);
    case 'groups-upgraded':
      return tStripped('proGroupsUpgraded', args);
    case 'longer-messages':
      return tStripped('proLongerMessagesSent', args);
    case 'pinned-conversations':
      return tStripped('proPinnedConversations', args);
  }
}

/**
 * Each stat cell with the copy it should carry on a fixture that has never used a Pro feature.
 *
 * Zero rather than a wildcard because the count is the point: a client that rendered the matrix but wired
 * the wrong counter would still satisfy a presence-only assertion.
 */
const PRO_STATS: ReadonlyArray<{ stat: ProStat; expected: string }> = (
  ['longer-messages', 'pinned-conversations', 'badges-sent', 'groups-upgraded'] as const
).map(stat => ({ stat, expected: proStatCopy(stat, 0) }));

/**
 * The three cells a test can actually move.
 *
 * `groups-upgraded` is excluded because **no client has a data source for it**: Android hard-codes
 * `groupsUpdated = 0` (`ProSettingsViewModel.kt`), iOS reads a `groupsUpgradedCounter` that has no write
 * site anywhere in the repo, and Desktop assigns the literal `0`. All three render it permanently
 * disabled behind a "coming soon" tooltip. Asserting a delta on it could only ever assert that an
 * unimplemented feature stayed unimplemented.
 */
export const MOVABLE_PRO_STATS = [
  'badges-sent',
  'longer-messages',
  'pinned-conversations',
] as const;

export type MovableProStat = (typeof MOVABLE_PRO_STATS)[number];

/** A reading of every stat a test can move, taken in one visit to the Pro settings screen. */
export type ProStatCounts = Record<MovableProStat, number>;

/**
 * Matches the normalisation `findMatchingLabelInElementArray` applies, so a reading compares equal to a
 * localizer string on exactly the same terms a locator's own text filter would.
 */
function normaliseCopy(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The number a stat cell is showing, from the copy it rendered.
 *
 * Self-checking on purpose: having parsed a leading integer it rebuilds the whole expected string from
 * it and refuses anything that does not match. That is what makes the reading trustworthy rather than a
 * regex that happens to find a digit —
 *
 * - **the loading state has no digits at all.** Both platforms substitute `""` for `{total}` while the
 *   stats are still resolving, so the cell reads a bare "Pro Badges Sent". A permissive parser would
 *   read that as a missing number; this throws.
 * - **an abbreviated count is not a count.** Android renders 1300 as "1.3k", where a leading-digit match
 *   would happily return 1.
 * - **copy drift is caught at the point of reading**, not three assertions later as a confusing delta.
 */
function parseProStatCount(stat: ProStat, copy: string): number {
  const normalised = normaliseCopy(copy);
  const leadingDigits = /^(\d+)\b/.exec(normalised);
  if (!leadingDigits) {
    throw new Error(
      `Pro stat "${stat}" rendered no count: "${copy}". Both platforms drop the number while the ` +
        `stats are loading, so this usually means the reading was taken before the screen settled.`
    );
  }
  const count = Number(leadingDigits[1]);
  const expected = proStatCopy(stat, count);
  if (normaliseCopy(expected) !== normalised) {
    throw new Error(
      `Pro stat "${stat}" rendered "${copy}", which is not the copy for ${count} ("${expected}"). ` +
        `Either the count is abbreviated (so this reading would be wrong) or the copy has changed.`
    );
  }
  return count;
}

/**
 * Read one stat cell's count off the Pro settings screen, which must already be open.
 *
 * **iOS only, and it throws rather than guessing on Android.** The count is only readable where the id
 * and the copy sit on the same element: on iOS the identifier is on the cell's title — the whole
 * "N Badges Sent" string — so the number survives on `label` once the identifier has taken over `name`.
 * On Android `qaTag` is `semantics { … }.testTag(…)` with no `mergeDescendants`, so the tagged `Row` is a
 * bare node with a `resource-id` and no text of its own, and the number lives on an untagged child
 * `Text`. There is no `id`/`accessibility id` that reaches it, and the other locator strategies are not
 * an option — so this refuses the platform instead of silently reading an empty string.
 *
 * The fix is one line in the client, not here: give the count `Text` in `ProStatItem` its own `qaTag`
 * (the shape `pro-screen-action-label` already uses for exactly this problem), or merge the row's
 * semantics. `pro-stats-groups-upgraded` is readable today only because its tooltip makes the row
 * `clickable`, and `clickable` merges descendants — which is an accident, not a design.
 */
async function readProStat(device: DeviceWrapper, stat: ProStat): Promise<number> {
  if (!device.isIOS()) {
    throw new Error(
      `readProStat is iOS-only: on Android the "pro-stats-${stat}" tag sits on ProStatItem's Row and the ` +
        `count is on an untagged child Text (ProSettingsHomeScreen.kt), so no id or accessibility id ` +
        `reaches it. Tag that Text in the client before calling this on Android.`
    );
  }
  const element = await device.waitForTextElementToBePresent({
    ...new ProStatCell(device, stat).build(),
    maxWait: PRESENT_MAX_WAIT,
  });
  const copy = (await device.getAttribute('label', element.ELEMENT)) ?? '';
  return parseProStatCount(stat, copy);
}

/**
 * Take a reading of every movable stat, starting and finishing on the home screen.
 *
 * **Every reading is a fresh visit, and that is load-bearing on iOS.** The two send counters are written
 * under an `ObservableKey` with the `.keyValue` generic while the settings view model observes the same
 * name under `.setting`, so nothing wakes the observer and the numbers are frozen for as long as the
 * screen stays open. They are correct on entry — `SessionProSettingsViewModel` queries them in its
 * initial state — so re-entering is what makes a second reading mean anything. A helper that held the
 * screen open across the action under test would read the baseline twice and pass regardless.
 *
 * Waits on the stats header first, `skipHealing` as `observeProGrant` does: healing falls back to a fuzzy
 * id match that resolves to a neighbouring `pro-settings-*` element on the non-Pro version of this
 * screen, which would turn "the account is not Pro" into a reading of the wrong element.
 */
export async function readProStats(device: DeviceWrapper): Promise<ProStatCounts> {
  return await test.step('Read the Pro stats', async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new ProSettingsEntry(device));
    await device.waitForTextElementToBePresent({
      ...new ProStatsHeader(device).build(),
      maxWait: PRESENT_MAX_WAIT,
      skipHealing: true,
    });

    const counts = {} as ProStatCounts;
    for (const stat of MOVABLE_PRO_STATS) {
      counts[stat] = await readProStat(device, stat);
    }
    device.log(`Pro stats: ${JSON.stringify(counts)}`);

    await device.navigateBack();
    await device.clickOnElementAll(new CloseSettings(device));
    return counts;
  });
}

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

/**
 * The primary action of whichever store-flow screen is showing, asserted present with its copy.
 *
 * On the refund screens this is the cheapest reading of which route the client chose: the same screen
 * labels the button `Open {store} Website` while the store's own refund window is open and `Request
 * Refund` once it has closed. The caller supplies the copy because the three clients do not agree on the
 * localizer key behind it — see `ProScreenAction`.
 */
export async function expectProScreenAction(
  device: DeviceWrapper,
  expectedCopy: string
): Promise<void> {
  await test.step('Verify the screen action', async () => {
    await device.waitForTextElementToBePresent({
      ...new ProScreenAction(device, expectedCopy).build(),
      maxWait: PRESENT_MAX_WAIT,
    });
  });
}

/**
 * Read the copy of the "Open URL" dialog's body — the one element carrying the URL about to be opened.
 *
 * Per-platform, for the reason spelled out on `OpenURLDialogDescription`: Android exposes the rendered
 * body as the node's `text`, while on iOS the accessibility identifier takes over `name` and the copy is
 * only reachable on `label`.
 *
 * App-wide rather than Pro-specific, like the locators it uses. It lives here because the Pro refund
 * specs are its only caller today; move it out the first time a link or donations spec wants it.
 */
async function readOpenUrlDialogCopy(device: DeviceWrapper): Promise<string> {
  const element = await device.waitForTextElementToBePresent({
    ...new OpenURLDialogDescription(device).build(),
    maxWait: PRESENT_MAX_WAIT,
  });

  if (device.isIOS()) {
    return (await device.getAttribute('label', element.ELEMENT)) ?? '';
  }
  return device.getTextFromElement(element);
}

/**
 * Tap the store-flow screen's primary action and assert the "Open URL" confirmation it raises offers a URL
 * naming `urlFragment`.
 *
 * Both halves matter. That the confirmation appears at all is a real claim — iOS's *originating* refund
 * screen deliberately does not raise it, going to StoreKit's native refund sheet instead — and the URL
 * inside it is the only thing that says where the button would actually have sent the user. The copy on the
 * screen says which route it *describes*; this says which route it *takes*.
 *
 * A fragment rather than the whole URL, and read-then-`toContain` rather than a locator text filter:
 * see `REFUND_URL_FRAGMENT` for both.
 */
export async function expectActionOpensUrl(
  device: DeviceWrapper,
  urlFragment: string
): Promise<void> {
  await test.step(`Verify the screen action opens a URL naming ${urlFragment}`, async () => {
    await device.clickOnElementAll(new ProScreenAction(device));
    await Promise.all([
      device.waitForTextElementToBePresent({
        ...new OpenURLDialog(device).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
      device.waitForTextElementToBePresent({
        ...new OpenURLDialogConfirmButton(device).build(),
        maxWait: PRESENT_MAX_WAIT,
      }),
    ]);
    const copy = await readOpenUrlDialogCopy(device);
    expect(copy).toContain(urlFragment);
  });
}

/**
 * Tap the store-flow screen's primary action and assert it raises **no** "Open URL" confirmation.
 *
 * The counterpart to `expectActionOpensUrl`, and the only way to state the iOS originating-refund branch:
 * there the button calls StoreKit's own refund sheet rather than opening a URL, so the assertion is the
 * absence. Bounded short on purpose — a dialog that is going to appear appears immediately.
 */
export async function expectActionOpensNoUrl(device: DeviceWrapper): Promise<void> {
  await test.step('Verify the screen action raises no Open URL confirmation', async () => {
    await device.clickOnElementAll(new ProScreenAction(device));
    await device.verifyElementNotPresent({
      ...new OpenURLDialog(device).build(),
      maxWait: ABSENT_MAX_WAIT,
    });
  });
}
