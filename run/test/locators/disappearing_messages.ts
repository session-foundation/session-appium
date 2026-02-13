import { LocatorsInterface } from '.';
import { DeviceWrapper } from '../../types/DeviceWrapper';
import {
  DISAPPEARING_TIMES,
  DisappearingOptions,
  StrategyExtractionObj,
} from '../../types/testing';

export class DisableDisappearingMessages extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `Disable disappearing messages`,
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Off',
        };
    }
  }
}

export class DisappearingMessageRadial extends LocatorsInterface {
  private timer: DISAPPEARING_TIMES;

  // Receives a timer argument so that one locator can handle all DM durations
  constructor(device: DeviceWrapper, timer: DISAPPEARING_TIMES) {
    super(device);
    this.timer = timer;
  }
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: this.timer,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: `${this.timer} - Radio`,
        } as const;
    }
  }
}

export class DisappearingMessagesMenuOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'disappearing-messages-menu-option',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Disappearing Messages',
        };
    }
  }
}
export class DisappearingMessagesSubtitle extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Disappearing messages type and time',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: `Disappearing messages type and time`,
        };
    }
  }
}

export class DisappearingMessagesTimerType extends LocatorsInterface {
  private timerType: DisappearingOptions;

  constructor(device: DeviceWrapper, timerType: DisappearingOptions) {
    super(device);
    this.timerType = timerType;
  }

  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: this.timerType,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: this.timerType,
        } as const;
    }
  }
}

export class FollowSettingsButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Follow setting',
        } as const;
    }
  }
}
export class SetDisappearMessagesButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Set button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Set button',
        } as const;
    }
  }
}

export class SetModalButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Set',
        } as const;
    }
  }
}
