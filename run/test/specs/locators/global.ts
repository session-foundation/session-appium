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
    return {
      strategy: 'accessibility id',
      selector: 'Enable',
    } as const;
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
