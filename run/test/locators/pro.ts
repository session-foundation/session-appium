import type { ProFeatureTestId } from '../utils/pro_message_features';

import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

/**
 * Where each platform keeps a row's visible copy, which decides what an expected-text lookup can match.
 *
 * **Android** — `qaTag` is a `testTag` surfaced as `resource-id`; it sets no text. So a row's own id is on
 * a container with no text of its own, and the copy lives on the child `ActionRowItem` tags it with
 * (`action-item-title`). An expected-text lookup therefore matches THAT node, not the row.
 *
 * **iOS** — an `accessibilityIdentifier` takes over `name`, so the copy is read from `label`. For a
 * `ListItemCell` the label merges title and subtitle (observed: `"Update Pro Access, Pro access
 * loading..."`), so a title-only match cannot succeed on a row that has a subtitle.
 *
 * The upshot, per locator, is documented on each class. Where a platform cannot match the copy the
 * lookup falls back to the id alone — which asserts less than the caller may assume, so it is called out.
 */

/**
 * The store-flow destination screens, by the id each one carries. Same strings on both platforms.
 */
export type ProScreenId =
  | 'pro-screen-cancel-plan-non-originating'
  | 'pro-screen-cancel-plan'
  | 'pro-screen-choose-plan-no-billing'
  | 'pro-screen-choose-plan-non-originating'
  | 'pro-screen-choose-plan'
  | 'pro-screen-plan-confirmation'
  | 'pro-screen-refund-in-progress'
  | 'pro-screen-refund-plan-non-originating'
  | 'pro-screen-refund-plan';

/** The four cells of the Pro stats matrix, in the order the screen lays them out. */
export type ProStat =
  | 'badges-sent'
  | 'groups-upgraded'
  | 'longer-messages'
  | 'pinned-conversations';

/**
 * Session Pro settings screens.
 *
 * The ids below are the **same strings on both platforms** — Android named this surface first
 * (`content-descriptions/src/main/res/values/strings.xml`) and iOS adopts those values verbatim, so
 * one locator serves both. Android already exposes `pro-menu-item`, `pro-settings-update-plan`,
 * `pro-settings-show-badge` and `pro-settings-show-badge-toggle`; the headers, the plan-expiry line
 * and the status banner are new on both sides.
 *
 * These states are reached by mocking (see `MobileTestContext`), which Android cannot inject yet, so the
 * specs using them are `iosIt` for now. The Android selectors are still written out rather than
 * stubbed: they are real ids, not guesses, and the specs become `bothPlatformsIt` with no locator
 * change once Android has env injection.
 */

/**
 * Another user's Pro badge on a 1-to-1 conversation header — the recipient-side proof that a sender's
 * Pro status verified, which is what `pro_badge_visibility` asserts.
 *
 * The two platforms need different shapes, and iOS deliberately cannot use `ProBadge` here.
 * `ConversationTitleView` marks the title an accessibility element, which collapses the badge out of
 * the tree entirely (no `pro-badge-*` element exists in the page source), so the badge's only trace is
 * the header's combined `@label`: display name, `, `, then "Session Pro". Android keeps the badge
 * addressable as a child of the header, so it matches the element directly.
 *
 * Matching `@label` rather than going through `text:` for the same reason as `ProStatusBanner`: `text:`
 * reads the element's value, and the identifier owns `name`.
 *
 * On Android this must target the badge **icon**, not `pro-badge-text`. `ProBadgeText` renders the
 * display name unconditionally and only the icon behind `if (showBadge)`, so scoping to the text
 * matches every conversation whether the sender is Pro or not — an assertion that cannot fail.
 */
export class ConversationHeaderProBadge extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'conversation-header-pro-badge' } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'conversation-header-pro-badge',
        } as const;
    }
  }
}

/**
 * The "Info" entry of a message's long-press menu, which opens the message-details screen.
 *
 * Both platforms show every action at once, so this is reachable straight after the long press.
 *
 * Android's long press opens its **own** context menu (`context_menu_item_title` rows: Reply, Copy,
 * Info, Select, Delete) — NOT the multi-select action mode from `menu_conversation_item_action.xml`,
 * where "Info" is declared `showAsAction="never"` and lives behind an overflow button. That menu is a
 * different surface, reached by selecting messages rather than by a plain long press, so nothing here
 * needs an overflow tap.
 *
 * Android matches the row id and filters by text, as the other `LongPress*` menu items do — NOT
 * `-android uiautomator`. That strategy resolves through UiAutomator's `UiObject` API, which only
 * searches the **active window**, and this menu is a popup in a window of its own (the page source
 * merges every window, so the item is plainly there in a dump while a `UiSelector` never finds it —
 * about as misleading as a failure gets). The `id` strategy goes through `UiObject2`, which walks
 * every window root, which is why the ANR and permission dialogs are reachable the same way.
 */
export class MessageInfoMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/context_menu_item_title',
          text: tStripped('info'),
        } as const;
      case 'ios':
        // iOS gives the action an explicit accessibilityLabel, distinct from its "Info" title.
        return { strategy: 'accessibility id', selector: 'Message info' } as const;
    }
  }
}

/**
 * The Session Pro badge glyph.
 *
 * Deliberately unscoped. On the *recipient's* device in a 1:1 with a Pro sender, the badge can only
 * belong to that sender — the recipient is not Pro — so an unscoped match is unambiguous there, and it
 * avoids hard-coding a view hierarchy that differs between platforms and moves between releases.
 * Scope it if you ever assert a badge on a screen showing several people.
 */
export class ProBadge extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-badge-icon' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-badge-icon' } as const;
    }
  }
}

/** The "Pro Badge" visibility row. */
export class ProBadgeSettingRow extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-show-badge' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-show-badge' } as const;
    }
  }
}

/** The toggle inside `ProBadgeSettingRow`. */
export class ProBadgeSettingToggle extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-show-badge-toggle' } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-show-badge-toggle',
        } as const;
    }
  }
}

/**
 * The "Cancel Pro Access" action in the manage section.
 *
 * Shown only for an auto-renewing subscriber with a confirmed status fetch, so asserting it absent proves
 * nothing alone — pair it with `ProRequestRefundRow`, which is unconditional in the same state.
 */
export class ProCancelPlanRow extends LocatorsInterface {
  private readonly expectedTitle?: string;

  constructor(device: DeviceWrapper, expectedTitle?: string) {
    super(device);
    this.expectedTitle = expectedTitle;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return this.expectedTitle
          ? ({ strategy: 'id', selector: 'action-item-title', text: this.expectedTitle } as const)
          : ({ strategy: 'id', selector: 'pro-settings-cancel-plan' } as const);
      case 'ios':
        // The row carries no subtitle, so its label is the title alone.
        return this.expectedTitle
          ? ({
              strategy: 'accessibility id',
              selector: 'pro-settings-cancel-plan',
              label: this.expectedTitle,
            } as const)
          : ({ strategy: 'accessibility id', selector: 'pro-settings-cancel-plan' } as const);
    }
  }
}

/** The "Pro FAQ" row of the help section. */
export class ProFaqRow extends LocatorsInterface {
  private readonly expectedTitle?: string;

  constructor(device: DeviceWrapper, expectedTitle?: string) {
    super(device);
    this.expectedTitle = expectedTitle;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return this.expectedTitle
          ? ({ strategy: 'id', selector: 'action-item-title', text: this.expectedTitle } as const)
          : ({ strategy: 'id', selector: 'pro-settings-faq' } as const);
      case 'ios':
        // `expectedTitle` is deliberately NOT applied: this row has a subtitle, and iOS merges title and
        // subtitle into one label, so the title alone can never match. Assert the copy on Android and take
        // presence from the id here.
        return { strategy: 'accessibility id', selector: 'pro-settings-faq' } as const;
    }
  }
}

/**
 * One row of the "This message used the following Session Pro features:" list on the message-info
 * screen.
 *
 * Addressed by the id every client now tags the row with — pass it from `proFeatureTestId`, which
 * owns the string the three clients agreed on.
 */
export class ProFeatureRow extends LocatorsInterface {
  private readonly testId: ProFeatureTestId;

  constructor(device: DeviceWrapper, testId: ProFeatureTestId) {
    super(device);
    this.testId = testId;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: this.testId } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: this.testId } as const;
    }
  }
}

export class ProFeaturesHeader extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-features-header' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-features-header' } as const;
    }
  }
}

/** Header above the manage-subscription rows, shown only once Pro is active. */
export class ProManageSectionHeader extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-manage-header' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-manage-header' } as const;
    }
  }
}

/**
 * The "Update Pro Access" row's subtitle for a plan that renews itself — "Pro auto-renewing in {time}".
 *
 * The sibling of `ProPlanExpiry`: same element, and the copy is what says which of the two states the
 * client thinks it is in. Reaching it needs `proAutoRenewing: 'autoRenewing'`, since both clients
 * otherwise take that flag from a status response a mocked run never receives.
 */
export class ProPlanAutoRenewal extends LocatorsInterface {
  private readonly time: string;

  constructor(device: DeviceWrapper, time: string) {
    super(device);
    this.time = time;
  }

  public build(): StrategyExtractionObj {
    const text = tStripped('proAutoRenewTime', { time: this.time });

    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-settings-update-plan-subtitle',
          text,
        } as const;
      case 'ios':
        // `label`, not `text`, as `ProPlanExpiry`: the identifier owns `name`.
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-update-plan-subtitle',
          label: text,
        } as const;
    }
  }
}

/**
 * The remaining-access line under `UpdateProAccessRow`.
 *
 * This is the generic `action-item-subtitle` **scoped under the row's own id**, not an id of its own.
 * Android already tags it that way inside the shared `ActionRowItem` component, so nesting costs no
 * app change on either platform, where a flat id would mean adding a per-call-site tag override to a
 * component used by action items app-wide.
 *
 * `action-item-subtitle` sits on **every** action item on the screen, so it must never be matched
 * bare — always scoped to a parent, as here. Any other row's subtitle follows this same shape.
 *
 * `time` is the rendered duration, not the raw timestamp. The app ceilings the remaining interval
 * into day/hour/minute units, so an expiry set N whole days out always renders as `N days` for any
 * test that reaches this screen within a day of setting it — which is what makes an exact match safe
 * despite the quantisation warning on `MobileTestContext.proAccessExpiry`.
 */
export class ProPlanExpiry extends LocatorsInterface {
  private readonly time: string;

  constructor(device: DeviceWrapper, time: string) {
    super(device);
    this.time = time;
  }

  public build(): StrategyExtractionObj {
    const text = tStripped('proExpiringTime', { time: this.time });

    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-settings-update-plan-subtitle',
          text,
        } as const;
      case 'ios':
        // `label`, not `text`: now the element carries an identifier, that identifier owns `name` and
        // the rendered duration is only reachable on `label`.
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-update-plan-subtitle',
          label: text,
        } as const;
    }
  }
}

/**
 * The "Update Pro Access" row's subtitle while a refund is processing — "Google is processing your refund
 * request".
 *
 * Worth asserting alongside the title because the two halves are built differently: the title is a static
 * string, this interpolates a provider name resolved by a runtime resource lookup. That lookup is why the
 * row once read "google_play is processing your refund request" on shrunk Android builds.
 */
export class ProRefundProcessingSubtitle extends LocatorsInterface {
  // Not `platform`, which the base class uses for the device's own platform.
  private readonly providerName: string;

  constructor(device: DeviceWrapper, providerName: string) {
    super(device);
    this.providerName = providerName;
  }

  public build(): StrategyExtractionObj {
    const text = tStripped('processingRefundRequest', { platform: this.providerName });

    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-settings-update-plan-subtitle',
          text,
        } as const;
      case 'ios':
        // `label`, not `text`, as `ProPlanExpiry`: the identifier owns `name`.
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-update-plan-subtitle',
          label: text,
        } as const;
    }
  }
}

/**
 * The "Renew Pro Access" action, shown on the Pro settings screen once access has expired.
 *
 * Both platforms show this row **or** `UpdateProAccessRow`, never both, so asserting this one is what
 * distinguishes an expired screen from an active one.
 *
 * Deliberately **not** paired with its title text. The row reads `proAccessRenew` on both platforms,
 * but on iOS the identifier owns `name` and the title moves to `@label`, and the copy is Crowdin-owned
 * either way — the id alone is unambiguous because only one element carries it.
 */
export class ProRenewPlanRow extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-renew-plan' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-renew-plan' } as const;
    }
  }
}

/**
 * The "Request Refund" action in the manage section, offered to an active subscriber who has not already
 * asked for one. Not the read-only "Refund Requested" row, which is the update-plan row's slot —
 * see `ProUpdatePlanRowTitle`.
 */
export class ProRequestRefundRow extends LocatorsInterface {
  private readonly expectedTitle?: string;

  constructor(device: DeviceWrapper, expectedTitle?: string) {
    super(device);
    this.expectedTitle = expectedTitle;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return this.expectedTitle
          ? ({ strategy: 'id', selector: 'action-item-title', text: this.expectedTitle } as const)
          : ({ strategy: 'id', selector: 'pro-settings-request-refund' } as const);
      case 'ios':
        // The row carries no subtitle, so its label is the title alone.
        return this.expectedTitle
          ? ({
              strategy: 'accessibility id',
              selector: 'pro-settings-request-refund',
              label: this.expectedTitle,
            } as const)
          : ({ strategy: 'accessibility id', selector: 'pro-settings-request-refund' } as const);
    }
  }
}

/**
 * One of the Pro store-flow destination screens, addressed by the id its content view carries.
 *
 * Only one of these is ever on screen, which is what lets `ProScreenDescription` stay generic.
 */
export class ProScreen extends LocatorsInterface {
  private readonly screen: ProScreenId;

  constructor(device: DeviceWrapper, screen: ProScreenId) {
    super(device);
    this.screen = screen;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: this.screen } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: this.screen } as const;
    }
  }
}

/**
 * The primary action button of whichever store-flow screen is showing, optionally paired with the copy it
 * should carry.
 *
 * Worth the pairing rather than presence alone, because on the refund screens the **label is the branch**:
 * inside the store's own refund window the button leaves for the store (`openPlatformWebsite` on Android
 * and Desktop, `openPlatformStoreWebsite` on iOS), and once that window has closed it becomes a plain
 * `requestRefund`. So the label and the URL the button opens are two independent readings of the same
 * decision, and a screen that changed one without the other is exactly the bug worth catching.
 *
 * Note the three clients do **not** agree on that key or on what it interpolates — iOS uses
 * `openPlatformStoreWebsite` with `platform_store`, Android and Desktop `openPlatformWebsite` with
 * `platform`, and they disagree again on whether that reads as the store or the platform for a Google Play
 * plan. So the copy has to be supplied per platform by the caller; there is no one string for it.
 *
 * `expectedCopy` is applied on both platforms. On iOS the identifier sits on the SwiftUI `Button`, whose
 * accessibility label stays its `Text`, so `label` carries it. On Android the tag sits on a Material 3
 * `Button`, which merges its descendants' semantics, so the tagged node carries the child `Text` as its
 * own `text` — unlike `CTAButtonPositive`, where the copy is only on an untagged child. **That last claim
 * is reasoned from the client source and not yet observed on a device**: the APK on the QA box predates
 * these screens' tags. If it turns out the merged node has no text, the fix is a `qaTag` on the button's
 * `Text` in the client, not a child selector here.
 */
export class ProScreenAction extends LocatorsInterface {
  private readonly expectedCopy?: string;

  constructor(device: DeviceWrapper, expectedCopy?: string) {
    super(device);
    this.expectedCopy = expectedCopy;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        // Two ids, not one: `pro-screen-action` is the clickable Button, whose own `text` is empty
        // because Compose leaves the copy on a child. Verified from a page-source dump — the node
        // reports `text=""` with a `TextView text="Request Refund"` inside — so a text filter here
        // matched nothing. The child now carries `pro-screen-action-label`, which is what a copy
        // assertion addresses. iOS needs no equivalent: its identifier and label sit on one element.
        return this.expectedCopy
          ? ({
              strategy: 'id',
              selector: 'pro-screen-action-label',
              text: this.expectedCopy,
            } as const)
          : ({ strategy: 'id', selector: 'pro-screen-action' } as const);
      case 'ios':
        // `label`, not `text`: the identifier owns `name`, as everywhere else on these screens.
        return this.expectedCopy
          ? ({
              strategy: 'accessibility id',
              selector: 'pro-screen-action',
              label: this.expectedCopy,
            } as const)
          : ({ strategy: 'accessibility id', selector: 'pro-screen-action' } as const);
    }
  }
}

/**
 * The body copy of whichever store-flow screen is showing, paired with the copy it should carry.
 *
 * Load-bearing for the refund screens in particular: the originating, different-account, <48h and >48h
 * variants share a title and — for three of them — a screen id, so the description is the only thing
 * that tells them apart.
 */
export class ProScreenDescription extends LocatorsInterface {
  private readonly copy: string;

  constructor(device: DeviceWrapper, copy: string) {
    super(device);
    this.copy = copy;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-screen-description', text: this.copy } as const;
      case 'ios':
        // `label`, not `text`: the identifier owns `name`.
        return {
          strategy: 'accessibility id',
          selector: 'pro-screen-description',
          label: this.copy,
        } as const;
    }
  }
}

/**
 * The description under the logo on the Pro settings screen, paired with the copy it should be showing.
 *
 * The copy is a pure function of the displayed status — `expired` -> `proAccessRenewStart`,
 * `never` -> `proFullestPotential`, `active` -> `proThanksForSupporting`, and nothing at all for
 * `unknown` — so the pairing is what makes this worth asserting. The id alone would only say a
 * description is present, which is true on every status that has one.
 *
 * Take care extending this to `proFullestPotential`: iOS and Desktop take their copy from Crowdin,
 * where the line break is `<br/>`, while Android's `strings.xml` uses `\n`. `tStripped` removes the
 * markup, so the two platforms do not end up with the same whitespace. `proAccessRenewStart` and
 * `proThanksForSupporting` carry no markup and are unaffected.
 */
export class ProSettingsDescription extends LocatorsInterface {
  private readonly copy: string;

  constructor(device: DeviceWrapper, copy: string) {
    super(device);
    this.copy = copy;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-settings-description',
          text: this.copy,
        } as const;
      case 'ios':
        // `label`, not `text`, for the same reason as `ProPlanExpiry`: the identifier owns `name`, so
        // the copy is only reachable on `label`.
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-description',
          label: this.copy,
        } as const;
    }
  }
}

/**
 * The Pro entry in the main settings list.
 *
 * Matched on the id alone. The row's label is a pure function of the backend status
 * (`never` -> "Upgrade Session", `active` -> "Session Pro Beta", `expired` -> "Renew Pro Beta"), but
 * pairing the id with that text does not work on iOS: an accessibility identifier becomes the
 * element's `name`, so the display text is no longer where a text matcher looks. Assert the label
 * separately if a test needs it; for navigation the id is unambiguous.
 */
export class ProSettingsEntry extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-menu-item' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-menu-item' } as const;
    }
  }
}

/**
 * The Pro row's TITLE in the user settings list, whose text is the account's Pro state.
 *
 * Separate from `ProSettingsEntry`, which is the tap target and carries no text of its own on either
 * platform — so the row's state is only readable through this one.
 */
export class ProSettingsEntryTitle extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-menu-item-title' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-menu-item-title' } as const;
    }
  }
}

/** Header above the four usage counters, shown only once Pro is active. */
/**
 * One cell of the "Your Pro Stats" matrix.
 *
 * Matched on the id alone. Each cell's id sits on its *title*, which is the whole "N badges sent"
 * string, so the value is only readable from the element's label — assert that separately if a test
 * cares about the number rather than the cell being rendered.
 */
export class ProStatCell extends LocatorsInterface {
  private readonly stat: ProStat;
  private readonly expectedText?: string;

  constructor(device: DeviceWrapper, stat: ProStat, expectedText?: string) {
    super(device);
    this.stat = stat;
    this.expectedText = expectedText;
  }

  public build(): StrategyExtractionObj {
    const selector = `pro-stats-${this.stat}` as const;

    switch (this.platform) {
      case 'android':
        // The cell's root, which carries the id and no text -- Compose's testTag sets a resource-id, not
        // a description. The count lives on a child tagged `pro-stats-value`; read it with
        // `ProStatValue`, which every cell shares, and tell them apart by their copy.
        return { strategy: 'id', selector } as const;
      case 'ios':
        // The identifier sits on the cell's title, i.e. the whole "N badges sent" string, so the copy is
        // readable from the label.
        return this.expectedText
          ? ({ strategy: 'accessibility id', selector, label: this.expectedText } as const)
          : ({ strategy: 'accessibility id', selector } as const);
    }
  }
}

export class ProStatsHeader extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-stats-header' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-stats-header' } as const;
    }
  }
}

/**
 * The Pro status banner at the top of the Pro settings screen.
 *
 * One element, several texts — the loading and error states render into the same slot, the way
 * `cta-heading` does, so the id is fixed and the state is asserted through the text.
 *
 * iOS matches `@label` rather than going through `text:`, which reads the element's *value*. Both
 * banners are `.accessibilityElement(children: .combine)`, and the loading one combines a
 * `ProgressView`, so the merged element is an `XCUIElementTypeActivityIndicator` whose value is the
 * progress (`"1"`), not the message — the message survives only in `@label`. The error banner combines
 * an `Image` instead, so its value happens to fall back to the text; matching `@label` covers both
 * rather than working for one state and silently not the other.
 */
export class ProStatusBanner extends LocatorsInterface {
  private readonly expectedText: string;

  constructor(device: DeviceWrapper, state: 'checking' | 'error') {
    super(device);
    this.expectedText =
      state === 'checking' ? tStripped('checkingProStatus') : tStripped('errorCheckingProStatus');
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-settings-status-banner',
          text: this.expectedText,
        } as const;
      case 'ios':
        // `label` rather than `text`: the identifier owns `name` on iOS, so the banner's message is
        // only reachable on `label`. That is what keeps this an accessibility-id match.
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-status-banner',
          label: this.expectedText,
        } as const;
    }
  }
}

/**
 * The count inside a Pro stat cell, on Android only.
 *
 * One id for all four cells (`ProStatItem` tags its own `Text`), so a match says "a stat count" and not
 * which. Callers read every match and identify each by its copy, which `parseProStatCount` validates by
 * rebuilding the expected string -- so a wrong pairing throws rather than returning another stat's number.
 *
 * iOS needs none of this: its identifier sits on the whole "N badges sent" string.
 */
export class ProStatValue extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-stats-value' } as const;
      case 'ios':
        throw new Error('ProStatValue is Android-only; on iOS read the label off ProStatCell.');
    }
  }
}

/** The row that opens the plan-management flow. */
/**
 * The "Support" row — the last row of the Pro settings screen in every state, so it is the anchor for
 * scrolling to the bottom. The manage section sits directly above it, which is what makes a
 * `verifyElementNotPresent` on a manage row mean the client omitted it rather than that it was off screen.
 */
export class ProSupportRow extends LocatorsInterface {
  private readonly expectedTitle?: string;

  constructor(device: DeviceWrapper, expectedTitle?: string) {
    super(device);
    this.expectedTitle = expectedTitle;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return this.expectedTitle
          ? ({ strategy: 'id', selector: 'action-item-title', text: this.expectedTitle } as const)
          : ({ strategy: 'id', selector: 'pro-settings-support' } as const);
      case 'ios':
        // `expectedTitle` is deliberately NOT applied: this row has a subtitle, and iOS merges title and
        // subtitle into one label, so the title alone can never match. Assert the copy on Android and take
        // presence from the id here.
        return { strategy: 'accessibility id', selector: 'pro-settings-support' } as const;
    }
  }
}

/**
 * The "Update Pro Access" row's title, which reads "Refund Requested" while a refund is processing —
 * both platforms keep one row and swap its title, so the title is what distinguishes the two states.
 *
 * Android's title carries the shared `action-item-title`, which every row on the screen has, so it must
 * never be matched without the text filter. iOS gives it a flat identifier because `ListItemCell` merges
 * title and subtitle into the row's own label.
 */
export class ProUpdatePlanRowTitle extends LocatorsInterface {
  private readonly copy: string;

  constructor(device: DeviceWrapper, copy: string) {
    super(device);
    this.copy = copy;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'action-item-title', text: this.copy } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'pro-settings-update-plan-title',
          label: this.copy,
        } as const;
    }
  }
}

export class UpdateProAccessRow extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'pro-settings-update-plan' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'pro-settings-update-plan' } as const;
    }
  }
}
