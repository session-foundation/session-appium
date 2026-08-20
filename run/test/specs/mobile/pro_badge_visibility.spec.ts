import { test, type TestInfo } from '@playwright/test';

import { makeAccountPro } from '../../../shared/pro_grant';
import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { ConversationItem } from '../../locators/home';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { enableProBadge, expectProBadgeFromSender } from '../../utils/pro_badge';
import { observeProGrant } from '../../utils/pro_refresh';

const MESSAGE = 'Checking my badge shows for you';

bothPlatformsIt({
  title: 'Pro badge shows to other users',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proBadgeVisibleToOthers,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A Pro subscriber sends a message and the recipient renders their Pro badge, which requires the ' +
    'recipient to verify a real cryptographic proof.',
});

/**
 * This is one of the few Pro assertions that genuinely needs the Pro backend rather than the
 * launch-arg mocks: the mocks are display-level and per-device, so they make Alice's *own* client
 * believe she is Pro but produce no proof for Bob's client to verify. Bob rendering the badge is
 * therefore the real test of the end-to-end grant.
 *
 * Both devices must be pointed at the same QA backend, which `IOS_PRO_CONTEXT` handles: the pubkey is
 * what libSession verifies proofs against, so a Bob left on the production key reads Alice's QA-signed
 * proof as invalid, silently strips the Pro content and stores her as non-Pro — a failure that looks
 * like a product bug rather than a misconfigured test.
 */
async function proBadgeVisibleToOthers(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { devices, prebuilt } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return await open_Alice1_Bob1_friends({
      platform,
      focusFriendsConvo: false,
      testInfo,
      testContext: IOS_PRO_CONTEXT,
    });
  });
  const { alice1, bob1 } = devices;
  const { alice, bob } = prebuilt;

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    await observeProGrant(alice1);
  });

  await enableProBadge(alice1, platform);

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, bob.userName), async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
    await alice1.sendMessage(MESSAGE);
  });

  await expectProBadgeFromSender(bob1, alice.userName, MESSAGE);

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
