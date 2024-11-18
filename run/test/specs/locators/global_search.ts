import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

export class NoteToSelfOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/search_result_title',
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
