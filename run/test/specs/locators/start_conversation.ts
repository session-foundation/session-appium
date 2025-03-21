import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

export class NewMessageOption extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'New direct message',
    } as const;
  }
}

export class CreateGroupOption extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Create group',
    } as const;
  }
}

export class JoinCommunityOption extends LocatorsInterface {
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
          selector: 'Join Community',
        };
    }
  }
}

export class InviteAFriendOption extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Invite friend button',
    } as const;
  }
}

export class CloseButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Close',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'X',
        };
    }
  }
}
// NEW MESSAGE SECTION
export class EnterAccountID extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Session id input box',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Session id input box',
        } as const;
    }
  }
}

// INVITE A FRIEND SECTION
export class AccountIDField extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Account ID',
    } as const;
  }
}

export class ShareButton extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Share button',
    } as const;
  }
}

export class CopyButton extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Copy button',
    } as const;
  }
}
