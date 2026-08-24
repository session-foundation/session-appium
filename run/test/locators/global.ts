import { DeviceWrapper } from '../../types/DeviceWrapper';
import { LocatorsInterface } from './index';

export class AccountIDDisplay extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Account ID',
          text: this.text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Account ID',
          text: this.text,
        } as const;
    }
  }
}

export class AllowPermissionLocator extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_allow_button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Allow',
        } as const;
    }
  }
}

export class Contact extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
          text: this.text,
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Contact',
          text: this.text,
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

export class CopyURLButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Copy URL',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Copy URL',
        } as const;
    }
  }
}

export class CTABody extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'cta-body',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'cta-body',
        } as const;
    }
  }
}

export class CTAButtonNegative extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiSelector().resourceId("cta-button-negative").childSelector(new UiSelector().className("android.widget.TextView"))', // The text is not exposed to the top level selector
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'cta-button-negative',
        } as const;
    }
  }
}

export class CTAButtonPositive extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector:
            'new UiSelector().resourceId("cta-button-positive").childSelector(new UiSelector().className("android.widget.TextView"))', // The text is not exposed to the top level selector
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'cta-button-positive',
        } as const;
    }
  }
}

export class CTAFeature extends LocatorsInterface {
  private index: number;

  constructor(device: DeviceWrapper, index: number) {
    super(device);
    this.index = index;
  }

  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: '-android uiautomator',
          selector: `new UiSelector().resourceId("cta-feature-${this.index}").childSelector(new UiSelector().className("android.widget.TextView"))`,
        } as const;
      case 'ios':
        // iOS feature indexing starts at 1, Android at 0
        return {
          strategy: 'accessibility id',
          selector: `cta-feature-${this.index + 1}`,
        } as const;
    }
  }
}

export class CTAHeading extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'pro-badge-text',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'cta-heading',
        } as const;
    }
  }
}

export class DenyPermissionLocator extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'com.android.permissioncontroller:id/permission_deny_button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Don’t Allow',
        } as const;
    }
  }
}

export class EnableLinkPreviewsModalButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'Enable',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Enable',
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

/**
 * The shared "Open URL" confirmation dialog — the modal every `urlOpen` confirmation in the app goes
 * through.
 *
 * **Here rather than in `pro.ts` on purpose.** The Pro refund screens are only one of its callers: it is
 * also raised from a conversation's links, the settings and Session Network screens and the donations
 * prompt (seven call sites on iOS alone, all of which now build it through one shared
 * `ConfirmationModal.Info.openUrl`). A locator living beside the Pro screens would read as Pro-specific
 * and get duplicated the first time a link test needed it.
 *
 * Both clients tag it with the same three strings, so one locator serves both:
 * `open-url-dialog`, `open-url-description`, `open-url-confirm-button`.
 *
 * **Desktop is only partly aligned** — `OpenUrlModal.tsx` carries `open-url-confirm-button` and
 * `copy-url-button`, but its body is the generic `modal-description` and it has no dialog-root id at
 * all. So these three do NOT describe Desktop; the desktop suite addresses the same dialog through
 * `Global.openUrlButton` / `Global.modalDescription` in `run/desktop/locators.ts`.
 *
 * The "Copy URL" action is deliberately absent: `CopyURLButton` above already finds it by its display
 * string, and `review_triggers.spec.ts` depends on that.
 */
export class OpenURLDialog extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'open-url-dialog',
        } as const;
      case 'ios':
        // A container (`XCUIElementTypeOther`), deliberately not an accessibility leaf: making the
        // modal's `contentView` an element of its own would collapse the description and the buttons
        // inside it out of the tree. So this asserts the dialog is up and nothing about its copy.
        return {
          strategy: 'accessibility id',
          selector: 'open-url-dialog',
        } as const;
    }
  }
}

/**
 * The "Open" button of `OpenURLDialog` — **not** the "Copy URL" action, which is `CopyURLButton`.
 *
 * Matched on the id alone. The button reads `open` on both platforms, but pairing that in is not worth
 * it: on iOS the identifier takes over `name`, and on Android the dialog's buttons are the same shape as
 * `cta-button-positive`, whose copy is not exposed on the tagged node. The id is unambiguous — only one
 * element carries it.
 */
export class OpenURLDialogConfirmButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'open-url-confirm-button',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'open-url-confirm-button',
        } as const;
    }
  }
}

/**
 * The body copy of `OpenURLDialog`, which is `urlOpenDescription` with the offered URL interpolated into
 * it — so this element is the only place a test can read *which* URL the dialog is about to open.
 *
 * Deliberately carries **no text filter**. The copy is one string built from a Crowdin template and a
 * URL the clients do not own (see `REFUND_URL_FRAGMENT`), and the harness's `text`/`label` filters are
 * exact after normalisation, so there is no way to match "this template, carrying that host" through a
 * locator. Callers read the element instead — `readOpenUrlDialogCopy` in `pro_settings.ts` handles the
 * per-platform attribute — and assert a fragment.
 */
export class OpenURLDialogDescription extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'open-url-description',
        } as const;
      case 'ios':
        // The copy is read from `label`, not `text`: the identifier takes over `name`, and the modal
        // sets the label from the rendered body. Same reason as `ProScreenDescription`.
        return {
          strategy: 'accessibility id',
          selector: 'open-url-description',
        } as const;
    }
  }
}
