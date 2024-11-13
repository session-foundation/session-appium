import { LocatorsInterface } from './index';

export class ModalHeading extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Modal heading',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Modal heading',
        } as const;
    }
  }
}

export class ModalDescription extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Modal description',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Modal description',
        } as const;
    }
  }
}

export class ContinueButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Continue',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Continue',
        } as const;
    }
  }
}

export class DeleteContactModalConfirm extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Yes',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Delete',
        } as const;
    }
  }
}

export class EnableLinkPreviewsModalButton extends LocatorsInterface {
  public build() {
    return {
      strategy: 'accessibility id',
      selector: 'Enable',
    } as const;
  }
}
