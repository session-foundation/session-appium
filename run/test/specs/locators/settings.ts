import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

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

export class UserSettings extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'User settings',
    } as const;
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
export class SaveNameChangeButton extends LocatorsInterface {
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

export class BlockedContacts extends LocatorsInterface {
  public build(text?: string) {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Contact',
          text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Blocked contacts',
          text,
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

export class ConversationsMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Conversations',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Conversations',
        } as const;
    }
  }
}

export class AppearanceMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Appearance',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Appearance',
        } as const;
    }
  }
}

export class SelectAppIcon extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/system_settings_app_icon',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Select alternate app icon',
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
export class AppDisguiseMeetingIcon extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'MeetingSE option',
        } as const;
      case 'ios':
        // NOTE see SES-3809
        throw new Error('No locators implemented for iOS');
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

export class PathMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'xpath',
          selector: `//android.widget.TextView[@text="Path"]`,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Path',
        } as const;
    }
  }
}
