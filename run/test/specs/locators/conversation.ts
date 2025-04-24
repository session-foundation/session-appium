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
    return {
      strategy: 'accessibility id',
      selector: 'More options',
    } as const;
  }
}

// android-only locator for the avatar
export class ConversationAvatar extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/singleModeImageView',
        } as const;
      case 'ios':
        throw new Error('Unsupported platform');
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
  public build(text?: string) {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Control message',
          text,
        } as const;
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
