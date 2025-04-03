import { ANDROID_XPATHS, IOS_XPATHS } from '../../../constants';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { ElementStates, StrategyExtractionObj } from '../../../types/testing';
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

// Returns the expected screenshot path for a locator, optionally varying by state
export abstract class LocatorsInterfaceScreenshot extends LocatorsInterface {
  abstract screenshotFileName(state?: ElementStates): string;
}
// When applying a nickname or username change
export class TickButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return { strategy: 'accessibility id', selector: 'Set' } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'Done' } as const;
    }
  }
}

export class ApplyChanges extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/action_apply',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Apply changes',
        } as const;
    }
  }
}

export class EditGroup extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/title',
          text: 'Edit group',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Edit group',
        } as const;
    }
  }
}

export class EditGroupName extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Username',
        } as const;
      case 'android':
        return {
          strategy: 'id',
          selector: 'Group name',
        } as const;
    }
  }
}

export class PrivacyButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'class name',
          selector: 'android.widget.TextView',
          text: 'Privacy',
        } as const;
      case 'ios':
        return { strategy: 'id', selector: 'Privacy' } as const;
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

export class ExitUserProfile extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Navigate up',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Close button',
        } as const;
    }
  }
}

export class UsernameSettings extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Display name',
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
          strategy: 'accessibility id',
          selector: 'Enter display name',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Username input',
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
          selector: 'Block - Switch',
        };
      case 'android':
        return {
          strategy: 'id',
          selector: `network.loki.messenger:id/title`,
          text: 'Block',
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
          strategy: 'accessibility id',
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
          strategy: 'accessibility id',
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
          selector: 'network.loki.messenger:id/title',
          text: 'Invite Contacts',
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
          strategy: 'accessibility id',
          selector: 'Delete on this device only',
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
          strategy: 'accessibility id',
          selector: 'Delete for everyone',
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

export class LeaveGroup extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `network.loki.messenger:id/title`,
          text: 'Leave group',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave group',
        };
    }
  }
}

export class BlockUserConfirmationModal extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Block',
    } as const;
  }
}

export class BlockedContactsSettings extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Blocked contacts',
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

export class RevealRecoveryPhraseButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
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

export class SetDisappearMessagesButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Set',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Set button',
        } as const;
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
          text: 'Session',
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
          selector: 'network.loki.messenger:id/linkPreviewView',
        };
      case 'ios':
        throw new Error(`No such element on iOS`);
    }
  }
}
export class MediaMessageInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'New direct message',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Text input box',
        };
    }
  }
}

export class SendMediaButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Send',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Send button',
        };
    }
  }
}

export class ImageName extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Photo taken on Jun 12, 2103 2:28:16 PM',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Photo, 19 March 2024, 5:13 pm',
        };
    }
  }
}
// TODO update StrategyExtractionObj to include Locator class
// export class PendingMessageRequestControlMessage extends LocatorsInterface {
//   public build(): StrategyExtractionObj {
//     switch (this.platform) {
//       case 'android':
//         return {
//           strategy: 'id',
//           selector: 'network.loki.messenger:id/textSendAfterApproval',
//           text: 'You will be able to send voice messages and attachments once the recipient has approved this message request.',
//         };
//       case 'ios':
//         return {
//           strategy: 'accessibility id',
//           selector: 'Control message',
//           text: 'You will be able to send voice messages and attachments once the recipient has approved this message request.',
//         };
//     }
//   }
// }

// export class MessageRequestAcceptedDescriptionControlMessage extends LocatorsInterface {
//   public build(): StrategyExtractionObj {
//     switch (this.platform) {
//       case 'ios':
//         return {
//           strategy: 'accessibility id',
//           selector: 'Control message',
//           text: 'Sending a message to this user will automatically accept their message request and reveal your Account ID.',
//         };
//       case 'android':
//         return {
//           strategy: 'id',
//           selector: 'network.loki.messenger:id/sendAcceptsTextView',
//           text: 'Sending a message to this user will automatically accept their message request and reveal your Account ID.',
//         };
//     }
//   }
// }

// export class MessageReadStatus extends LocatorsInterface {
//   public build(): StrategyExtractionObj {
//     switch (this.platform) {
//       case 'android':
//         return {
//           strategy: 'id',
//           selector: 'network.loki.messenger:id/messageStatusTextView',
//           text: 'Read',
//         };
//       case 'ios':
//         return {
//           strategy: 'accessibility id',
//           selector: 'Message sent status: Read',
//         };
//     }
//   }
// }
