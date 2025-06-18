import { LocatorsInterface } from '.';

export class PhotoLibrary extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Photos',
    } as const;
  }
}

export class DisguisedApp extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'MeetingSE',
      maxWait: 5000,
    } as const;
  }
}
export class IOSSaveToFiles extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save to Files',
        } as const;
    }
  }
}
export class IOSSaveButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save',
        } as const;
    }
  }
}
export class IOSReplaceButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Replace',
        } as const;
    }
  }
}

export class iOSPhotosContinuebutton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        throw new Error('Unsupported platform');
      case 'ios':
        return {
          strategy: 'xpath',
          selector: `//XCUIElementTypeButton[@name="Continue"]`,
          maxWait: 5000,
        } as const;
    }
  }
}
