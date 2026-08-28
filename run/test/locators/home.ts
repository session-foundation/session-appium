import type { DeviceWrapper } from '../../types/DeviceWrapper';

import { StrategyExtractionObj } from '../../types/testing';
import { LocatorsInterface } from './index';

export class BackgroundPermsAllowButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'whitelist-confirm-button',
        } as const;
      case 'ios':
        throw new Error('Not implemented');
    }
  }
}

export class BackgroundPermsCancelButton extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'whitelist-cancel-button',
        } as const;
      case 'ios':
        throw new Error('Not implemented');
    }
  }
}

export class ConversationItem extends LocatorsInterface {
  public text: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Conversation list item',
          text: this.text,
        } as const;
    }
  }
}

// Find pin icon belonging to a specific conversation
export class ConversationPinnedIcon extends LocatorsInterface {
  constructor(
    device: DeviceWrapper,
    private name: string
  ) {
    super(device);
  }
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        // Legacy xpath: the Android icon carries no content description, so it can only be reached
        // through the row's hierarchy. See `iconPinned` in `view_conversation.xml`.
        return {
          strategy: 'xpath',
          selector: `//android.view.ViewGroup[android.widget.TextView[@content-desc='Conversation list item' and @text='${this.name}']]/android.widget.ImageView[@resource-id='network.loki.messenger:id/iconPinned']`,
        } as const;
      case 'ios':
        // The marker is identical in every row, so the conversation name is what tells them apart, and
        // `FullConversationCell` puts it in the IDENTIFIER rather than the label - a label would be read
        // aloud right after the screen reader has already announced the same name from the cell. Matching
        // the composite id also avoids pairing an id with text, which breaks the moment an id is added to
        // an element: the display text moves to `@label` and the pair no longer matches.
        return {
          strategy: 'accessibility id',
          selector: `Pinned icon: ${this.name}`,
        } as const;
    }
  }
}

export class EmptyLandingPage extends LocatorsInterface {
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
}

/**
 * The Session Pro badge beside the wordmark in the home screen's header.
 *
 * Scoped rather than using the generic `pro-badge-icon`, because the same widget class renders in
 * several roles and an unscoped match would find whichever happened to be on screen. iOS names it
 * through `SessionProBadge.AccessibilityIdentifier`; Android carries it as a view id.
 *
 * Hidden rather than absent when the user is not Pro, and on Android a `gone` view is not in the
 * hierarchy at all — so a "not found" here means "no badge", which is a state and not a broken locator.
 *
 * Android's id is package-qualified because it is an **XML view id** (`activity_home.xml`), which Appium
 * addresses as `<package>:id/<name>`. The bare form is for Compose `testTag`s — both appear in this
 * directory and they are not interchangeable: the bare form here resolves only through locator healing,
 * which the runner fails the test for rather than quietly accepting.
 */
export class HomeHeaderProBadge extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/sessionHeaderProBadge',
        } as const;
      case 'ios':
        return { strategy: 'accessibility id', selector: 'home-header-pro-badge' } as const;
    }
  }
}

export class LongPressBlockOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'accessibility id',
          selector: 'Block',
        };
      case 'ios':
        throw new Error('Not implemented');
    }
  }
}

export class MessageRequestItem extends LocatorsInterface {
  public text?: string | undefined;
  constructor(device: DeviceWrapper, text?: string) {
    super(device);
    this.text = text;
  }
  public build() {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Message request',
          text: this.text,
        } as const;
    }
  }
}

export class MessageRequestsBanner extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Message requests banner',
        } as const;
    }
  }
}
// For identifying a conversation with a specific last message in it
export class MessageSnippet extends LocatorsInterface {
  public conversationName: string;
  public messageText: string;

  constructor(device: DeviceWrapper, conversationName: string, messageText: string) {
    super(device);
    this.conversationName = conversationName;
    this.messageText = messageText;
  }

  public build() {
    switch (this.platform) {
      case 'ios':
        return {
          strategy: 'xpath', // For nested elements like this xpath is unfortunately the best choice
          selector: `//XCUIElementTypeCell[@name="Conversation list item" and @label="${this.conversationName}"]//XCUIElementTypeStaticText[@name="${this.messageText}"]`,
        } as const;

      case 'android':
        return {
          strategy: 'xpath',
          selector: `//android.widget.LinearLayout[.//android.widget.TextView[@content-desc="Conversation list item" and @text="${this.conversationName}"]]//android.widget.TextView[@resource-id="network.loki.messenger:id/snippetTextView" and @text="${this.messageText}"]`,
        } as const;
    }
  }
}

export class PinConversationOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Pin',
        } as const;
    }
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

export class ReviewPromptItsGreatButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'enjoy-session-positive-button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'enjoy-session-positive-button',
        };
    }
  }
}

export class ReviewPromptNeedsWorkButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'enjoy-session-negative-button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'enjoy-session-negative-button',
        };
    }
  }
}

export class ReviewPromptNotNowButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'not-now-button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'not-now-button',
        };
    }
  }
}

export class ReviewPromptOpenSurveyButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'open-survey-button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'open-survey-button',
        };
    }
  }
}

export class ReviewPromptRateAppButton extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'rate-app-button',
        };
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'rate-app-button',
        };
    }
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

export class UnpinConversationOption extends LocatorsInterface {
  public build(): StrategyExtractionObj {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger:id/unpinTextView',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Unpin',
        } as const;
    }
  }
}
