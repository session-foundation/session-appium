import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

export class HideRecoveryPasswordButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Hide recovery password button',
    } as const;
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
          strategy: 'accessibility id',
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

export class AppearanceMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
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
          selector: 'network.loki.messenger:id/system_settings_app_icon',
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
