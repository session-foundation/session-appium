import type { DeviceWrapper } from '../../../types/DeviceWrapper';

import { StrategyExtractionObj } from '../../../types/testing';
import { LocatorsInterface } from './index';

export class EmptyLandingPage extends LocatorsInterface {
  public build() {
    switch (this.platform) {
      case 'android':
        return {
          strategy: 'id',
          selector: 'network.loki.messenger.qa:id/emptyStateContainer',
        } as const;
      case 'ios':
        return {
          strategy: 'accessibility id',
          selector: 'Empty list',
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
          selector: `//android.widget.LinearLayout[.//android.widget.TextView[@content-desc="Conversation list item" and @text="${this.conversationName}"]]//android.widget.TextView[@resource-id="network.loki.messenger.qa:id/snippetTextView" and @text="${this.messageText}"]`,
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
