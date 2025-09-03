import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

export class NoteToSelfOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
          text: 'Note to Self',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Note to Self',
        };
    }
  }
}

export class CancelSearchButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/search_cancel',
          text: 'Cancel',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Cancel',
        };
    }
  }
}
