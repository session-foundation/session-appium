import { tStripped } from '../../localizer/lib';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

/**
 * Session Pro settings screens.
 *
 * The ids below are the **same strings on both platforms** — Android named this surface first
 * (`content-descriptions/src/main/res/values/strings.xml`) and iOS adopts those values verbatim, so
 * one locator serves both. Android already exposes `pro-menu-item`, `pro-settings-update-plan`,
 * `pro-settings-show-badge` and `pro-settings-show-badge-toggle`; the headers, the plan-expiry line
 * and the status banner are new on both sides.
 *
 * These states are reached by mocking (see `IOSTestContext`), which Android cannot inject yet, so the
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

/** Header above the feature list, present in every state of the Pro settings screen. */
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
 * despite the quantisation warning on `IOSTestContext.proAccessExpiry`.
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

/** Header above the four usage counters, shown only once Pro is active. */
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

/** The row that opens the plan-management flow. */
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
