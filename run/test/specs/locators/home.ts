import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface, LocatorsInterfaceScreenshot } from './index';
import * as path from 'path';

export class EmptyLandingPage extends LocatorsInterfaceScreenshot {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/emptyStateContainer',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Empty list',
        } as const;
    }
  }
  // The landing page has two different states depending on the onboarding flow taken
  public screenshotFileName(state: 'new_account' | 'restore_account') {
    return path.join('run', 'screenshots', this.platform, `landingpage_${state}.png`);
  }
}
export class ConversationItem extends LocatorsInterface {
  public build(text?: string) {
    return {
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: text,
    } as const;
  }
}

export class PlusButton extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'New conversation button',
    } as const;
  }
}

export class SearchButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: `Search icon`,
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Search button',
        };
    }
  }
}
