import path from 'path';
import { EmptyLandingPage } from '../locators/home';

// Extends locator classes with baseline screenshot paths for visual regression testing
// If a locator appears in multiple states, a state argument must be provided to screenshotFileName()

export class EmptyLandingPageScreenshot extends EmptyLandingPage {
  // The landing page has two different states depending on the onboarding flow taken
  public screenshotFileName(state: 'new_account' | 'restore_account'): string {
    return path.join('run', 'screenshots', this.platform, `landingpage_${state}.png`);
  }
}
