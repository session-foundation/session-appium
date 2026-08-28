import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { HomeHeaderProBadge } from '../../locators/home';
import { open_Alice1 } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';

bothPlatformsIt({
  title: 'The home screen shows a Pro badge once the account is Pro',
  risk: 'medium',
  countOfDevicesNeeded: 1,
  isPro: true,
  testCb: proHomeHeaderBadge,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'The Session wordmark on the home screen carries a Pro badge for a subscriber, and none for a ' +
    'standard user.',
});

/**
 * The badge beside the wordmark on the user's OWN home screen.
 *
 * Distinct from `pro_badge_visibility`, which is about a *recipient* rendering a sender's badge and is
 * therefore a proof-verification test needing two devices. This one reads the account's own state and
 * needs nobody else — different surface, different input, one device.
 *
 * **Both halves are asserted, and the absent half is why.** "The badge is not found" on its own proves
 * nothing: a misspelt identifier, a renamed view or a screen that never loaded all produce it. Asserting
 * absence first and presence afterwards with the *same* locator is what makes each half mean something —
 * the locator is shown to work by the half that finds it, and the state is shown to have changed by the
 * pair. On Android the view is `gone` until the user is Pro, and a `gone` view is not in the hierarchy at
 * all, so "not found" there is a state rather than a broken lookup.
 *
 * Deliberately not asserted: what the badge does once a plan lapses. iOS gates it on
 * `currentUserHasProAccess` (**access**) and Android on the account's own `isPro` (**derived status**),
 * which agree for an ordinary subscriber but need not during the overhang — a lapsed plan whose proof is
 * still live. That is `pro_overhang`'s question, and pinning it here would assert one platform's answer
 * as the rule.
 */
async function proHomeHeaderBadge(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device, alice } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return await open_Alice1({ platform, testInfo, testContext: PRO_BACKEND_CONTEXT });
  });

  await test.step('A standard account carries no badge', async () => {
    await device.verifyElementNotPresent({
      ...new HomeHeaderProBadge(device).build(),
      maxWait: 5000,
    });
  });

  await test.step('Alice becomes a Pro subscriber', async () => {
    // A real grant rather than a display mock. The mocks would satisfy this screen, but the same fixture
    // then reads as Pro everywhere else too, so a spec built on one cannot tell "the header honours the
    // account's Pro state" from "the harness told the whole client it was Pro".
    await makeAccountPro({ user: alice, platform });
    // Leaves the app on the home screen, which is where the badge lives.
    await observeProGrant(device);
  });

  await test.step('The badge is now beside the wordmark', async () => {
    await device.waitForTextElementToBePresent(new HomeHeaderProBadge(device));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
