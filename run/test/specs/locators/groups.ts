import { LocatorsInterface } from '.';
import { StrategyExtractionObj } from '../../../types/testing';

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
