import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { testCommunityName } from '../../../constants/community';
import { StrategyExtractionObj } from '../../../types/testing';
import { getAppDisplayName } from '../utils/devnet';
import { LocatorsInterface } from './index';

export class MessageInput extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Message input box',
    } as const;
  }
}

export class SendButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Send message button',
    };
  }
}

export class ScrollToBottomButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/scrollToBottomButton',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Scroll button',
        } as const;
    }
  }
}
export class ConversationSettings extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'conversation-options-avatar',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'More options',
        } as const;
    }
  }
}

export class DeletedMessage extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Deleted message',
    } as const;
  }
}
// Empty conversation state
export class EmptyConversation extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Empty list',
        } as const;
    }
  }
}

export class Hide extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Clear', // I guess they changed the label to Hide but not the ax id
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Hide',
        } as const;
    }
  }
}
export class AttachmentsButton extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Attachments button',
    } as const;
  }
}

export class OutgoingMessageStatusSent extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: `Message sent status: Sent`,
    } as const;
  }
}

export class CallButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Call button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Call',
        } as const;
    }
  }
}

export class ConversationHeaderName extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector: `new UiSelector().resourceId("Conversation header name").childSelector(new UiSelector().resourceId("pro-badge-text"))`,
          text: this.text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Conversation header name',
          text: this.text,
        } as const;
    }
  }
}

export class NotificationSettings extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Notifications',
    } as const;
  }
}

export class NotificationSwitch extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.settings:id/switch_text',
          text: `All ${getAppDisplayName()} notifications`,
        } as const;
      case 'ios':
        throw new Error('Platform not supported');
    }
  }
}

export class BlockedBanner extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'blocked-banner',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Blocked banner',
        } as const;
    }
  }
}

export class DeleteConversationMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-conversation-menu-option',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete Conversation',
        } as const;
    }
  }
}
export class DeleteConversationModalConfirm extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-conversation-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        } as const;
    }
  }
}

export class HideNoteToSelfMenuOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'hide-nts-menu-option',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Hide Note to Self',
        } as const;
    }
  }
}

export class HideNoteToSelfConfirmButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'hide-nts-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Hide',
        } as const;
    }
  }
}

export class ShowNoteToSelfMenuOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'hide-nts-menu-option', // Yes this has the 'hide' ID
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Show Note to Self',
        } as const;
    }
  }
}

export class ShowNoteToSelfConfirmButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'show-nts-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Show',
        } as const;
    }
  }
}
export class DeleteContactMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-contact-menu-option',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete Contact',
        } as const;
    }
  }
}
export class DeleteContactConfirmButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-contact-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        } as const;
    }
  }
}

export class CommunityInviteConfirmButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'invite-contacts-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Invite contacts button',
        } as const;
    }
  }
}

export class CommunityInvitation extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/openGroupTitleTextView',
          text: testCommunityName,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Community invitation',
          text: testCommunityName,
        } as const;
    }
  }
}

export class EditNicknameButton extends LocatorsInterface {
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

export class NicknameInput extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'nickname-input',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Username input',
        } as const;
    }
  }
}

export class SaveNicknameButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'set-nickname-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save',
        } as const;
    }
  }
}

export class PreferredDisplayName extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'preferred-display-name',
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
