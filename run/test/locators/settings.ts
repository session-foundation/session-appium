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
export class NotificationsMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Notifications',
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
        return { strategy: 'id', selector: 'Privacy' } as const;
    }
  }
}

export class RecoveryPasswordMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Recovery password menu item',
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
