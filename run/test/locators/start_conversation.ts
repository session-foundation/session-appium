import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

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

export class CopyButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Copy button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Copy button',
        } as const;
    }
  }
}

export class CreateGroupOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Create group',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Create group',
        } as const;
    }
  }
}

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

export class InviteAFriendOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Invite friend button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Invite friend button',
        } as const;
    }
  }
}

export class JoinCommunityOption extends LocatorsInterface {
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
          selector: 'Join Community',
        };
    }
  }
}

export class NewMessageOption extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'New direct message',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'New direct message',
        } as const;
    }
  }
}
export class NextButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Next',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Next',
        } as const;
    }
  }
}

export class ShareButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Share button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Share button',
        } as const;
    }
  }
}
