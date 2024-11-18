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
            selector: 'More options'
        } as const;
    }
}

// android-only locator for the avatar 
export class ConversationAvatar extends LocatorsInterface {
    public build() {
        return {
            strategy: 'id',
            selector: 'network.loki.messenger:id/singleModeImageView'
        } as const
    }
}
