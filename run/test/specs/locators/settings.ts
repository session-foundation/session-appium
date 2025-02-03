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
