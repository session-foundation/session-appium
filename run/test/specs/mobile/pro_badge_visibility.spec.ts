import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../../types/allure';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { CloseSettings } from '../../locators';
import { MessageBody } from '../../locators/conversation';
import { ConversationItem } from '../../locators/home';
import {
  ConversationHeaderProBadge,
  ProBadgeSettingToggle,
  ProSettingsEntry,
} from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { IOS_PRO_CONTEXT } from '../../utils/capabilities_ios';
import { makeAccountPro } from '../../utils/mock_pro';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { forceStopAndRestart } from '../../utils/utilities';

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
      iOSContext: IOS_PRO_CONTEXT,
    });
  });
  const { alice1, bob1 } = devices;
  const { alice, bob } = prebuilt;

  await test.step('Alice becomes a Pro subscriber', async () => {
    await makeAccountPro({ user: alice, platform });
    // The grant is only observed on a fresh launch: the client caches its Pro status, so without this
    // Alice's client would still consider her non-Pro.
    await forceStopAndRestart(alice1);
    await alice1.dismissCTA();
  });

  // Being Pro is not the same as advertising it: badge visibility is a separate per-user setting that
  // a grant never touches (it writes the proof and the expiry only), so a freshly-Pro account
  // advertises nothing until this is turned on.
  //
  // Read-then-set rather than a bare tap: a blind toggle flips whatever state it finds, so it would
  // silently disable the badge the day the default changes — and a tap that lands on the row instead of
  // the switch does nothing at all, which is indistinguishable from success until the assertion fails
  // three steps later.
  await test.step('Alice turns her Pro badge on', async () => {
    await alice1.clickOnElementAll(new UserSettings(alice1));
    await alice1.clickOnElementAll(new ProSettingsEntry(alice1));

    const toggle = await alice1.waitForTextElementToBePresent(new ProBadgeSettingToggle(alice1));
    if ((await alice1.getAttribute('value', toggle.ELEMENT)) !== '1') {
      await alice1.click(toggle.ELEMENT);
    }

    const after = await alice1.waitForTextElementToBePresent(new ProBadgeSettingToggle(alice1));
    const state = await alice1.getAttribute('value', after.ELEMENT);
    if (state !== '1') {
      throw new Error(
        `Pro badge toggle is still off (value=${state}) after being set. Without it Alice advertises ` +
          `no badge, and the assertion below would fail as though the feature were broken.`
      );
    }

    await alice1.navigateBack();
    await alice1.clickOnElementAll(new CloseSettings(alice1));
  });

  await test.step(TestSteps.SEND.MESSAGE(alice.userName, bob.userName), async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, bob.userName));
    await alice1.sendMessage(MESSAGE);
  });

  await test.step("Bob sees Alice's Pro badge", async () => {
    await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
    // Wait for the message first: the badge travels with it, so asserting the badge before the message
    // has arrived would be a race rather than a check.
    await bob1.waitForTextElementToBePresent(new MessageBody(bob1, MESSAGE));
    // In a 1:1 the badge renders in the conversation header, not beside the message: the author label
    // that carries it is group-only (`shouldShowAuthorName` guards on `isGroupThread`).
    await bob1.waitForTextElementToBePresent(new ConversationHeaderProBadge(bob1));
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1);
  });
}
