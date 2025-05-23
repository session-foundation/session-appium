import { LocatorsInterface } from '.';
import { StrategyExtractionObj } from '../../../types/testing';
import { DISAPPEARING_TIMES } from '../../../types/testing';
import { DeviceWrapper } from '../../../types/DeviceWrapper';

export class DisappearingMessagesMenuOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: `network.loki.messenger:id/title`,
          text: 'Disappearing messages',
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
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: `Disappearing messages type and time`,
        };
    }
  }
}

export class DisableDisappearingMessages extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
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
export class SetDisappearMessagesButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: 'Set button',
    } as const;
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
export class DisappearingMessageRadial extends LocatorsInterface {
  private timer: DISAPPEARING_TIMES;

  // Receives a timer argument so that one locator can handle all DM durations
  constructor(device: DeviceWrapper, timer: DISAPPEARING_TIMES) {
    super(device);
    this.timer = timer;
  }
  public build(): StrategyExtractionObj {
    return {
      strategy: 'accessibility id',
      selector: `${this.timer} - Radio`,
    } as const;
  }
}
