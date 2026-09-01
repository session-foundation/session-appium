import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

export class CancelSearchButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/search_cancel',
          text: 'Cancel',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Close',
        };
    }
  }
}

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
        // The row carries `pro-badge-text` as its identifier, which takes over the element's `name`, so
        // the conversation name it displays is reachable only on `label` — the same shape Android
        // matches, differing only in which attribute exposes the text.
        return {
          strategy: 'accessibility id',
          selector: 'pro-badge-text',
          label: 'Note to Self',
        };
    }
  }
}
