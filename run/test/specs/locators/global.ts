import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { LocatorsInterface } from './index';

export class ModalHeading extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Modal heading',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Modal heading',
        } as const;
    }
  }
}

export class ModalDescription extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Modal description',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Modal description',
        } as const;
    }
  }
}

export class ContinueButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Continue',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Continue',
        } as const;
    }
  }
}

export class EnableLinkPreviewsModalButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Enable',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Enable',
        } as const;
    }
  }
}

export class Contact extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
          text: this.text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Contact',
          text: this.text,
        } as const;
    }
  }
}

export class AllowPermissionLocator extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_allow_button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Allow',
        } as const;
    }
  }
}

export class DenyPermissionLocator extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_deny_button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Don’t Allow',
        } as const;
    }
  }
}

export class AccountIDDisplay extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Account ID',
          text: this.text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Account ID',
          text: this.text,
        } as const;
    }
  }
}

export class CopyURLButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Copy URL',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Copy URL',
        } as const;
    }
  }
}

// NOTE: This is meant to be a generic locator for all CTAs but for the time being the iOS implementation is limited to the Donate CTA
// See SES-4930
export class CTAHeading extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
        } as const;
      case 'ios':
        return {
          strategy: 'xpath',
          selector: `//XCUIElementTypeStaticText[starts-with(@name,'Session Needs')]`,
        } as const;
    }
  }
}

// NOTE: This is meant to be a generic locator for all CTAs but for the time being the iOS implementation is limited to the Donate CTA
// See SES-4930
export class CTABody extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'cta-body',
        } as const;
      case 'ios':
        return {
          strategy: 'xpath',
          selector: `//XCUIElementTypeStaticText[starts-with(@name,'Powerful forces are trying to')]`,
        } as const;
    }
  }
}

// NOTE: This is meant to be a generic locator for all CTAs but for the time being the iOS implementation is not available
// See SES-4930
export class CTAFeature extends LocatorsInterface {
  private index: number;

  constructor(device: DeviceWrapper, index: number) {
    super(device);
    this.index = index;
  }

  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `cta-feature-${this.index}`,
        } as const;
      case 'ios':
        throw new Error('CTAFeature locator is not available on iOS');
    }
  }
}

// NOTE: This is meant to be a generic locator for all CTAs but for the time being the iOS implementation is limited to the Donate CTA
// See SES-4930
export class CTAButtonPositive extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiSelector().resourceId("cta-button-positive").childSelector(new UiSelector().className("android.widget.TextView"))', // The text is not exposed to the top level selector
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Donate',
        } as const;
    }
  }
}

// NOTE: This is meant to be a generic locator for all CTAs but for the time being the iOS implementation is limited to the Donate CTA
// See SES-4930
export class CTAButtonNegative extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiSelector().resourceId("cta-button-negative").childSelector(new UiSelector().className("android.widget.TextView"))', // The text is not exposed to the top level selector
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Maybe Later',
        } as const;
    }
  }
}
