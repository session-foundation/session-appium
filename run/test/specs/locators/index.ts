import { ANDROID_XPATHS, IOS_XPATHS } from '../../../constants';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ElementStates, StrategyExtractionObj } from '../../../types/testing';
import { getAppDisplayName } from '../utils/devnet';
import { SupportedPlatformsType } from '../utils/open_app';

export abstract class LocatorsInterface {
  protected readonly platform: SupportedPlatformsType;

  abstract build(): StrategyExtractionObj;

  constructor(device: DeviceWrapper) {
    if (device.isAndroid()) {
      this.platform = 'android';
    } else if (device.isIOS()) {
      this.platform = 'ios';
    } else {
      console.info('unsupported device type:', device);
      throw new Error('unsupported device type');
    }
  }

  protected isIos() {
    return this.platform === 'ios';
  }

  protected isAndroid() {
    return this.platform === 'android';
  }
}

export function describeLocator(locator: StrategyExtractionObj & { text?: string }): string {
  const { strategy, selector, text } = locator;

  // Trim selector if its too long, show beginning and end
  const maxSelectorLength = 80;
  const halfLength = Math.floor(maxSelectorLength / 2);
  const trimmedSelector =
    selector.length > maxSelectorLength
      ? `${selector.substring(0, halfLength)}…${selector.substring(selector.length - halfLength)}`
      : selector;

  const base = `${strategy} "${trimmedSelector}"`;
  return text ? `${base} and text "${text}"` : base;
}

// Returns the expected screenshot path for a locator, optionally varying by state
export abstract class LocatorsInterfaceScreenshot extends LocatorsInterface {
  abstract screenshotFileName(state?: ElementStates): string;
}

export class ApplyChanges extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/action_apply',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Apply changes',
        } as const;
    }
  }
}

export class ReadReceiptsButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'android:id/summary',
          text: 'Show read receipts for all messages you send and receive.',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Read Receipts - Switch',
        } as const;
    }
  }
}

export class CloseSettings extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Close',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Close button',
        } as const;
    }
  }
}

export class UsernameDisplay extends LocatorsInterface {
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
          selector: 'Username',
          text: this.text,
        } as const;
    }
  }
}

export class EditUsernameButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Edit',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Username',
        } as const;
    }
  }
}

export class UsernameInput extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'class name',
          selector: 'android.widget.EditText',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Username input',
        } as const;
    }
  }
}

export class ClearInputButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'clear-input-button',
        } as const;
      case 'ios':
        return {
          strategy: 'id',
          selector: 'clear-input-button',
        } as const;
    }
  }
}

export class FirstGif extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'xpath',
          selector: ANDROID_XPATHS.FIRST_GIF,
        };
      case 'ios':
        return {
          strategy: 'xpath',
          selector: IOS_XPATHS.FIRST_GIF,
        };
    }
  }
}

export class MediaMessage extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Media message',
        };
      case 'ios':
        return {
          strategy: 'class name',
          selector: 'XCUIElementTypeImage',
        };
    }
  }
}
export class BlockUser extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Block',
        };
      case 'android':
        return {
          strategy: 'id',
          selector: 'block-user-menu-option',
        };
    }
  }
}

export class ChangeProfilePictureButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Image picker',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Upload',
        };
    }
  }
}

export class ImagePermissionsModalAllow extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
        };
      case 'ios':
        return { strategy: 'accessibility id', selector: 'Allow Full Access' };
    }
  }
}

export class JoinCommunityButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Join community button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Join',
        };
    }
  }
}

export class CommunityInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Community input',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Enter Community URL',
        };
    }
  }
}

export class InviteContactsButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Invite button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Invite button',
        };
    }
  }
}

export class InviteContactsMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'invite-contacts-menu-option',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Invite Contacts',
        };
    }
  }
}

export class DeleteMessageLocally extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-only-on-this-device',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete for me',
        };
    }
  }
}

export class DeleteMessageForEveryone extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-for-everyone',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete for everyone',
        };
    }
  }
}

export class DeleteMessageConfirmationModal extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Delete',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        };
    }
  }
}

export class BlockUserConfirmationModal extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'block-user-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Block',
        } as const;
    }
  }
}

export class BlockedContactsSettings extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          // Temporary fix until there's a unique ID
          strategy: '-android uiautomator',
          selector: `new UiSelector().text("View and manage blocked contacts.")`,
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Blocked Contacts',
        };
    }
  }
}

export class DeclineMessageRequestButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Delete message request',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete message request',
        };
    }
  }
}

export class DeleteMessageRequestButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `android:id/title`,
          text: 'Delete',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        };
    }
  }
}

export class DeleteMesssageRequestConfirmation extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Delete',
    };
  }
}

export class DownloadMediaButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Download',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Download',
        };
    }
  }
}

export class ShareExtensionIcon extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.google.android.apps.photos:id/text',
          text: `${getAppDisplayName()}`, // Session QA or AQA
        };
      case 'ios':
        return {
          strategy: 'xpath',
          selector: `//XCUIElementTypeCell[@name="Session"]`,
        };
    }
  }
}
export class LinkPreview extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        throw new Error(`No such element on Android`);
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Session | Send Messages, Not Metadata. | Private Messenger',
        } as const;
    }
  }
}

export class LinkPreviewMessage extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/linkPreviewView',
        };
      case 'ios':
        throw new Error(`No such element on iOS`);
    }
  }
}

export class ImageName extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      // Dates can wildly differ between emulators but it will begin with "Photo taken on" on Android
      case 'android':
        return {
          strategy: 'xpath',
          selector: `//*[starts-with(@content-desc, "Photo taken on")]`,
        };
      case 'ios':
        throw new Error(`No such element on iOS`);
    }
  }
}
