import { LocatorsInterface } from '.';
import { StrategyExtractionObj } from '../../../types/testing';
import { englishStripped } from '../../../localizer/Localizer';
import type { UserNameType } from '@session-foundation/qa-seeder';

export class GroupNameInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Group name input',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group name input',
        } as const;
    }
  }
}

export class CreateGroupButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
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

export class InviteContactConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Confirm invite button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Confirm invite button',
        } as const;
    }
  }
}

export class EditGroupName extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Edit',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Edit group name',
        } as const;
    }
  }
}

export class EditGroupNameInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Group name',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group name text field',
        } as const;
    }
  }
}

export class LeaveGroupButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `network.loki.messenger:id/title`,
          text: 'Leave group',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave group',
        } as const;
    }
  }
}

export class LeaveGroupConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Leave',
    } as const;
  }
}
export class LatestReleaseBanner extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      // On Android, the text of the banner is exposed to Appium
      // so it's possible to verify that the banner is visible and it has the correct text
      case 'android':
        return {
          strategy: 'id',
          selector: 'Version warning banner',
          text: englishStripped('groupInviteVersion').toString(),
        } as const;
      case 'ios':
        // On iOS, the text is currently not exposed to Appium
        return {
          strategy: 'accessibility id',
          selector: 'Version warning banner',
        } as const;
    }
  }
}
export class RecreateGroupBannerAdmin extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Legacy group banner',
      text: englishStripped('legacyGroupAfterDeprecationAdmin').toString(),
    } as const;
  }
}

export class RecreateGroupBannerMember extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Legacy group banner',
      text: englishStripped('legacyGroupAfterDeprecationMember').toString(),
    } as const;
  }
}

export class RecreateGroupButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Legacy Groups Recreate Button',
        } as const;
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Accept message request',
        } as const;
    }
  }
}

export class GroupMember extends LocatorsInterface {
  public build(username?: UserNameType): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Contact',
          text: `${username}`,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Contact',
          text: `${username}`,
        } as const;
    }
  }
}

export class RemoveMemberButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Remove contact button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Remove contact button',
        } as const;
    }
  }
}

export class ConfirmRemovalButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Remove',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Remove',
        } as const;
    }
  }
}

export class MemberStatus extends LocatorsInterface {
  public build(text?: string): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Contact status',
          text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Contact status',
          text,
        } as const;
    }
  }
}
