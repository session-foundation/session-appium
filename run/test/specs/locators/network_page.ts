import { LocatorsInterface } from '.';

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
