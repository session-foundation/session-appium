import { tStripped } from '../../localizer/lib';
import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

export class AppDisguiseMeetingIcon extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'MeetingSE option',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Meetings option',
        } as const;
    }
  }
}

export class AppDisguisePage extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'class name',
          selector: 'android.widget.ScrollView',
        } as const;
      case 'ios':
        return {
          strategy: 'class name',
          selector: 'XCUIElementTypeTable',
        } as const;
    }
  }
}

export class AppearanceMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("Appearance"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Appearance',
        } as const;
    }
  }
}

export class ClassicLightThemeOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/theme_option_classic_light',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Classic Light',
        } as const;
    }
  }
}

/** The clear-data dialog's cancel action, tagged the same way as {@link ClearDataConfirmButton}. */
export class ClearDataCancelButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'Cancel' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'Cancel' } as const;
    }
  }
}

/**
 * The destructive action on the **first** stage - the one that raises the confirmation.
 *
 * The two stages are one dialog on Android, whose text swaps, but two stacked modals on iOS: the
 * confirmation is presented OVER `NukeDataModal` rather than replacing it, so both are in the tree at
 * once. That is why iOS needs a distinct id here and Android does not.
 *
 * Android's is the English display string, because `AlertDialog` falls back to a button's own text when
 * the call site gives it no `qaTag`. A real id rather than a text match, but one that moves with locale.
 *
 * Pressing this on a **standard** account with "device only" selected deletes immediately on both
 * platforms - there is no second confirmation on that branch. Only press it where one is expected.
 */
export class ClearDataConfirmButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'Clear' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'clear-data-confirm-button' } as const;
    }
  }
}

/**
 * The body of the **first** stage, carrying the generic copy every account sees.
 *
 * Separate from `ModalDescription` for the stacking reason on {@link ClearDataConfirmButton}: on iOS
 * that id belongs to the confirmation presented on top, and asserting it before pressing Clear would
 * read the wrong modal.
 */
export class ClearDataDialogDescription extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'Modal description' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'clear-data-description' } as const;
    }
  }
}

/**
 * The "Clear Data" row at the bottom of the user settings list.
 *
 * The id is a hand-written tag on both platforms, NOT derived from the display string, so a lookup
 * says nothing about the copy - pair it with `expectControlCopy` and `sessionClearData`.
 */
export class ClearDataMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'Clear data' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'Clear data' } as const;
    }
  }
}

/**
 * The "device only" / "device and network" radios on the first stage of the clear-data dialog.
 *
 * Device-only is preselected on both platforms, so only the network one is ever tapped. The other is
 * still worth naming: which branches the dialog offers is part of what the screen promises, and
 * nothing else reads the preselected one.
 *
 * Slug ids on both platforms, so neither carries its copy - `expectControlCopy` with `clearDeviceOnly`
 * / `clearDeviceAndNetwork`. That check only bites on iOS; the Android label is a child node.
 */
export class ClearDeviceAndNetworkRadio extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'clear-device-and-network-radio' } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'clear-device-and-network-radio',
        } as const;
    }
  }
}

/** The preselected branch — see {@link ClearDeviceAndNetworkRadio}. */
export class ClearDeviceOnlyRadio extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return { strategy: 'id', selector: 'clear-device-only-radio' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'clear-device-only-radio' } as const;
    }
  }
}

export class CloseAppButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'class name',
          selector: 'android.widget.TextView',
          text: 'Close App',
        } as const;
      case 'ios':
        throw new Error('Modal not implemented for iOS');
    }
  }
}

export class CommunityMessageRequestSwitch extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector: 'new UiSelector().text("Community Message Requests")',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Community Message Requests',
        } as const;
    }
  }
}

export class ConversationsMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("Conversations"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Conversations',
        } as const;
    }
  }
}

export class DonationsMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'donate-menu-item',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Donate',
        } as const;
    }
  }
}

/**
 * The Fast Mode row on the Notifications screen, addressed by its title.
 *
 * The row's toggle is tagged separately; this is the title, so waiting on it says the screen is up without
 * touching the control a spec might want to operate. Both clients carry the same id — see the id's own
 * kebab-case form, which is what lets one locator serve both.
 */
export class FastModeOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'preferences-option-enable-push',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'preferences-option-enable-push',
        } as const;
    }
  }
}
export class HideRecoveryPasswordButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Hide recovery password button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Hide recovery password button',
        } as const;
    }
  }
}

export class LockAppOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'preferences-option-lock-app',
        } as const;
      case 'ios':
        throw new Error('Not implemented on iOS');
    }
  }
}

export class LockAppToggle extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'preferences-option-lock-app-toggle',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Lock App - Switch',
        } as const;
    }
  }
}

export class NotificationsMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("Notifications"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Notifications',
        } as const;
    }
  }
}

export class PathMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("path-menu-item"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Path',
        } as const;
    }
  }
}

export class PrivacyMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Privacy',
        } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'Privacy' } as const;
    }
  }
}

export class ProAnimatedDisplayPictureModalDescription extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
          text: tStripped('proAnimatedDisplayPictureModalDescription'),
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: ' users can upload GIFs', // Yes this is an intentional whitespace
        } as const;
    }
  }
}

export class RecoveryPasswordMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("Recovery password menu item"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Recovery password menu item',
        } as const;
    }
  }
}
export class RecoveryPhraseContainer extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Recovery password container',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Recovery password container',
        } as const;
    }
  }
}
export class RevealRecoveryPhraseButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Reveal recovery phrase button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Continue',
        };
    }
  }
}

export class SaveNameChangeButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'update-username-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save',
        } as const;
    }
  }
}
export class SaveProfilePictureButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Save',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save',
        } as const;
    }
  }
}

export class SelectAppIcon extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Select app icon"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Select alternate app icon',
        } as const;
    }
  }
}

export class SettingsModalsEnableButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'preferences-dialog-option-enable',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Continue',
        } as const;
    }
  }
}

export class UserAvatar extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'User settings',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'User settings',
          text: 'Profile picture', // There's more than one User settings so this is to specify the avatar
        } as const;
    }
  }
}

export class UserSettings extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'User settings',
    } as const;
  }
}

export class VersionNumber extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textStartsWith("Version"))',
        } as const;
      case 'ios':
        return {
          strategy: 'xpath',
          selector: `//XCUIElementTypeStaticText[contains(@name, "Version")]`,
        } as const;
    }
  }
}

export class ViewQR extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector: `new UiSelector().text("${tStripped('qrView')}")`,
        } as const;
      case 'ios':
        throw new Error('Not implemented on iOS');
    }
  }
}

export class YesButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Yes',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Yes',
        } as const;
    }
  }
}
