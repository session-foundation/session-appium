import { LocatorsInterface } from '.';

export class ChromeNotificationsNegativeButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.chrome:id/negative_button',
        } as const;
      case 'ios':
        throw new Error('Unsupported platform');
    }
  }
}

export class ChromeUseWithoutAnAccount extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.chrome:id/signin_fre_dismiss_button',
          maxWait: 500,
        } as const;
      case 'ios':
        throw new Error('Unsupported platform');
    }
  }
}

export class SafariAddressBar extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'TabBarItemTitle',
        } as const;
    }
  }
}

export class SafariShareButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'ShareButton',
        } as const;
    }
  }
}
export class URLInputField extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.chrome:id/url_bar',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'URL',
        } as const;
    }
  }
}
