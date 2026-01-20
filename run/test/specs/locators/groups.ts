import type { UserNameType } from '@session-foundation/qa-seeder';

import { LocatorsInterface } from '.';
import { englishStrippedStr } from '../../../localizer/englishStrippedStr';
import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { StrategyExtractionObj } from '../../../types/testing';
import { GROUPNAME } from '../../../types/testing';

export class ConfirmPromotionModalButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Confirm',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
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

export class DeleteGroupConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'delete-group-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        } as const;
    }
  }
}

export class DeleteGroupMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().resourceId("delete-group-menu-option"))',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave group', // yep this is leave even for the delete option
        } as const;
    }
  }
}

export class EditGroupDescriptionInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'update-group-info-description-input',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group description text field',
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
          selector: 'update-group-info-name-input',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group name text field',
        } as const;
    }
  }
}

export class GroupDescription extends LocatorsInterface {
  private groupDescription?: string;
  // Receives a group description argument so that one locator can handle all possible group names
  constructor(device: DeviceWrapper, groupDescription?: string) {
    super(device);
    this.groupDescription = groupDescription;
  }
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'group-description',
        } as const;
      case 'ios': {
        const groupDescription = this.groupDescription;
        return {
          strategy: 'accessibility id',
          selector: 'Description',
          text: groupDescription,
        } as const;
      }
    }
  }
}

export class GroupMember extends LocatorsInterface {
  public build(username?: UserNameType): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
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
export class InviteContactConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'qa-collapsing-footer-action_invite',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Confirm invite button',
        } as const;
    }
  }
}
export class InviteContactSendInviteButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Send Invite',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
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
          text: englishStrippedStr('groupInviteVersion').toString(),
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
export class LeaveGroupConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'leave-group-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave',
        } as const;
    }
  }
}

export class LeaveGroupMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'leave-group-menu-option',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave group',
        } as const;
    }
  }
}

export class ManageAdminsMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'manage-admins-menu-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class ManageMembersMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'manage-members-menu-option',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Manage Members',
        };
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

export class PromoteMemberFooterButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'qa-collapsing-footer-action_promote',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class PromoteMemberModalConfirm extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Promote',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}
export class PromoteMembersMenuItem extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'promote-members-menu-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class RemoveMemberButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'qa-collapsing-footer-action_remove',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Remove contact button',
        } as const;
    }
  }
}
export class RemoveMemberMessagesRadial extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'remove-member-messages-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}
export class RemoveMemberRadial extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'remove-member-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class SaveGroupNameChangeButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'update-group-info-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Save',
        } as const;
    }
  }
}

export class ShareMessageHistoryRadial extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'share-message-history-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class ShareNewMessagesRadial extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'share-new-messages-option',
        } as const;
      case 'ios':
        throw new Error('Manage Members not available on iOS');
    }
  }
}

export class UpdateGroupInformation extends LocatorsInterface {
  private groupName?: GROUPNAME;

  // Receives a group name argument so that one locator can handle all possible group names
  constructor(device: DeviceWrapper, groupName?: GROUPNAME) {
    super(device);
    this.groupName = groupName;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Edit',
        };
      case 'ios': {
        const groupName = this.groupName;
        if (!groupName) {
          throw new Error('groupName must be provided for iOS');
        }
        return {
          strategy: 'accessibility id',
          selector: groupName,
        };
      }
    }
  }
}
