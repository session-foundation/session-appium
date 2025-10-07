import path from 'path';

import { MessageBody } from '../locators/conversation';
import { EmptyLandingPage } from '../locators/home';
import { AppDisguisePage } from '../locators/settings';

// Extends locator classes with baseline screenshot paths for visual regression testing
// If a locator appears in multiple states, a state argument must be provided to screenshotFileName()

export class EmptyLandingPageScreenshot extends EmptyLandingPage {
  // The landing page has two different states depending on the onboarding flow taken
  public screenshotFileName(state: 'new_account' | 'restore_account'): string {
    return path.join('run', 'screenshots', this.platform, `landingpage_${state}.png`);
  }
}

export class AppDisguisePageScreenshot extends AppDisguisePage {
  public screenshotFileName(): string {
    return path.join('run', 'screenshots', this.platform, 'app_disguise.png');
  }
}

export class MessageBodyScreenshot extends MessageBody {
  // The message body locator can appear in different states depending on the message content
  public screenshotFileName(
    state:
      | 'incoming_reply_message'
      | 'incoming_short_message'
      | 'outgoing_reply_message'
      | 'outgoing_short_message'
  ): string {
    return path.join('run', 'screenshots', this.platform, `messagebody_${state}.png`);
  }
}
