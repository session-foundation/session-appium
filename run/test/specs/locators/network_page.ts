import { LocatorsInterface } from '.';
import { DeviceWrapper } from '../../../types/DeviceWrapper';

export class SessionNetworkMenuItem extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'session-network-menu-item',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Session Network',
        } as const;
    }
  }
}

export class SessionNetworkLearnMoreNetwork extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Learn more link',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Learn more link',
        } as const;
    }
  }
}

export class SessionNetworkLearnMoreStaking extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Learn about staking link',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Learn about staking link',
        } as const;
    }
  }
}

export class LastUpdatedTimeStamp extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Last updated timestamp',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Last updated timestamp',
        } as const;
    }
  }
}

export class OpenLinkButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Open',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Open',
        } as const;
    }
  }
}
export class SESHPrice extends LocatorsInterface {
  private expectedText: string;

  constructor(device: DeviceWrapper, priceValue: number) {
    super(device);
    this.expectedText = `$${priceValue.toFixed(2)} USD`;
  }

  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'SESH price',
          text: this.expectedText,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'SENT price',
          text: this.expectedText,
        } as const;
    }
  }
}

export class StakingRewardPoolAmount extends LocatorsInterface {
  private expectedText: string;

  constructor(device: DeviceWrapper, amount: number) {
    super(device);
    // Format with commas and SESH suffix
    this.expectedText = `${amount.toLocaleString('en-US')} SESH`;
  }

  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Staking reward pool amount',
          text: this.expectedText,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Staking reward pool amount',
          text: this.expectedText,
        } as const;
    }
  }
}

export class MarketCapAmount extends LocatorsInterface {
  private expectedText: string;

  constructor(device: DeviceWrapper, amount: number) {
    super(device);
    // Round to whole number, then format with commas and USD suffix
    const rounded = Math.round(amount);
    this.expectedText = `$${rounded.toLocaleString('en-US')} USD`;
  }

  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Market cap amount',
          text: this.expectedText,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Market cap amount',
          text: this.expectedText,
        } as const;
    }
  }
}
