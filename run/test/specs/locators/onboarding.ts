import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

// SHARED LOCATORS

export class ErrorMessage extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'error-message',
          maxWait: 5000,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Error message',
          maxWait: 5000,
        } as const;
    }
  }
}

export class BackButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/back_button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Back',
        } as const;
    }
  }
}

export class WarningModalQuitButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'id',
      selector: 'Quit',
    } as const;
  }
}

// SPLASH SCREEN
export class CreateAccountButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Create account button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Create account button',
        } as const;
    }
  }
}

export class AccountRestoreButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Restore your session button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Restore your session button',
        } as const;
    }
  }
}

export class SplashScreenLinks extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Open URL',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Open URL',
        } as const;
    }
  }
}
export class TermsOfServiceButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Terms of service button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Terms of Service',
        } as const;
    }
  }
}

export class PrivacyPolicyButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Privacy policy button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Privacy Policy',
        } as const;
    }
  }
}

// CREATE ACCOUNT FLOW

export class DisplayNameInput extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Enter display name',
        } as const;
      case 'android':
        return {
          strategy: 'id',
          selector: 'Enter display name',
        } as const;
    }
  }
}

// LOAD ACCOUNT FLOW

export class SeedPhraseInput extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Recovery phrase input',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Recovery password input',
        } as const;
    }
  }
}

// MESSAGE NOTIFICATIONS

export class SlowModeRadio extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Slow mode notifications button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Slow mode notifications button',
        } as const;
    }
  }
}

export class LoadingAnimation extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Loading animation',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Loading animation',
        } as const;
    }
  }
}
