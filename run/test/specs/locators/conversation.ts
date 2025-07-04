import { LocatorsInterface } from './index';

export class MessageInput extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Message input box',
    } as const;
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
  public build(text?: string) {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Conversation header name',
          text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Conversation header name',
          text,
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
          text: 'All Session notifications',
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
export class DeleteModalConfirm extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Delete',
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
          selector: 'Hide',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Hide',
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
