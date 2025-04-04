import { LocatorsInterface } from '.';
import { StrategyExtractionObj } from '../../../types/testing';
import { englishStripped } from '../../../localizer/i18n/localizedString';

export class GroupNameInput extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Group name input',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group name input',
        };
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
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Create group',
        };
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
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Confirm invite button',
        };
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
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Edit group name',
        };
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
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Group name text field',
        };
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
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Leave group',
        };
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
