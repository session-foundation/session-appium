import { LocatorsInterface } from '.';

export class PhotoLibrary extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Photos',
    } as const;
  }
}
