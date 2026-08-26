import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import {
  COUNTDOWN_START_THRESHOLD,
  MESSAGE_DELIVERY_TIMEOUT_MS,
  PRO_MAX_CHARS,
} from '../../../shared/constants';
import { makeAccountPro } from '../../../shared/pro_grant';
import { bothPlatformsIt } from '../../../types/sessionIt';
import {
  MessageInput,
  MessageLengthCountdown,
  MessageReadMore,
  SendButton,
} from '../../locators/conversation';
import { CTAButtonNegative } from '../../locators/global';
import { ConversationItem } from '../../locators/home';
import {
  ProManageSectionHeader,
  ProRenewPlanRow,
  ProSettingsDescription,
  ProSettingsEntry,
  ProStatsHeader,
} from '../../locators/pro';
import { UserSettings } from '../../locators/settings';
import { open_Alice1_Bob1_friends } from '../../state_builder';
import { runOnlyOnAndroid, sleepFor } from '../../utils';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { PRO_BACKEND_CONTEXT } from '../../utils/pro_context';
import { observeProGrant } from '../../utils/pro_refresh';
import { forceStopAndRestart } from '../../utils/utilities';

/** Lands the countdown on exactly the threshold, so the value asserted is the limit being applied. */
const AT_PRO_THRESHOLD = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

bothPlatformsIt({
  title: 'Pro features survive the plan expiring',
  risk: 'high',
  countOfDevicesNeeded: 2,
  testCb: proOverhang,
  isPro: true,
  allureSuites: {
    parent: 'Session Pro',
  },
  allureDescription:
    'A lapsed plan whose proof still has time left displays as expired while the features keep ' +
    'working, because access comes from the proof and the displayed state comes from the plan.',
});

/**
 * The one disagreement between the two Pro values that is a feature.
 *
 * Access comes from the proof; the displayed state comes from the plan. When a plan lapses the proof
 * does not expire with it, so there is a window where the client shows "expired" and still serves every
 * Pro feature — deliberate, and the reason the two values exist separately at all.
 *
 * Asserted together in one spec on purpose. Each half alone is satisfied by a client that has collapsed
 * the two values back into one: a client reading only the proof shows Active and passes the feature
 * check, and a client reading only the plan shows expired and passes the display check. Only the pair
 * fails for a client that has lost the distinction, which is the regression worth catching — it is
 * silent, and it takes a paid-for feature away from someone who is still entitled to it.
 *
 * The expired half comes from a CONFIRMED status rather than from a seeded one. Seeding it off a past
 * access expiry reaches a similar-looking screen by a different route — the client has no response, so
 * it offers to RECOVER a plan it cannot see rather than to renew one it knows has lapsed — correct for
 * that state, and a different one. The overhang is a plan we have been TOLD is over, so the fixture
 * supplies that.
 */
async function proOverhang(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Two devices and a seeded contact, because the claim has a receiving half: only a second party
  // verifies the credential, and that is what a mocked proof could never satisfy.
  const { devices, prebuilt } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
    testContext: PRO_BACKEND_CONTEXT,
  });
  const { alice1, bob1 } = devices;

  // A REAL grant, seconds long. No mock reaches this state: the expired half has to be a status the
  // backend CONFIRMED, and the surviving half has to be a credential a recipient will actually accept.
  const PLAN_SECONDS = 12;
  const grantedAt = Date.now();
  await test.step('Grant Pro with a plan that lapses in seconds', async () => {
    await makeAccountPro({ user: prebuilt.alice, platform, durationSeconds: PLAN_SECONDS });
  });

  await test.step('Let the client observe it while the plan is still live', async () => {
    // Active FIRST: a fetch that finds an already-expired plan leaves the client with no usable
    // credential, so there would be nothing for the overhang to preserve.
    await observeProGrant(alice1);
    // A seconds-long, non-renewing grant is inside the expiring-soon window the moment it lands, so
    // that CTA arms too — and on mobile the Pro CTAs surface on the HOME screen rather than over the
    // Pro settings screen, which is where desktop's appear. Cleared here so it is not sitting over the
    // conversation list when the next step goes looking for a contact.
    // `observeProGrant` opens Pro settings and closes back out to the home screen, and the CTA fires on
    // that RETURN — not on launch. A seconds-long, non-renewing grant is inside the expiring window the
    // moment it lands, so this is deterministic rather than incidental.
    await alice1.checkCTA('proExpiringSoon');
    await alice1.clickOnElementAll(new CTAButtonNegative(alice1));
  });

  await test.step('Let the plan lapse, then read the status again', async () => {
    // To a deadline from the grant, not a fresh countdown: the time spent reaching Active was already
    // burning the plan.
    const lapsedAt = grantedAt + (PLAN_SECONDS + 2) * 1000;
    await sleepFor(Math.max(0, lapsedAt - Date.now()));
    await forceStopAndRestart(alice1);
  });

  await test.step('Clear any Pro CTA raised by the lapse', async () => {
    // Mobile raises the Pro CTAs on the HOME screen after a relaunch. Deliberately tolerant rather
    // than asserted: with a real lapse the expired CTA did not arm reliably on iOS, and whether it
    // does is a question for `pro_expiring_soon_cta` rather than a precondition of this spec. All this
    // needs is that no modal is left covering the conversation list.
    await alice1.checkCTA('proExpired');
    await alice1.clickOnElementAll(new CTAButtonNegative(alice1));
  });

  await test.step('Verify the Pro message limit still applies, and the message lands', async () => {
    await alice1.clickOnElementAll(new ConversationItem(alice1, prebuilt.bob.userName));
    // A marker on the TAIL, so the recipient assertion can be a cheap contains rather than a match on
    // 9,800 characters — and so that what it proves is exactly the right thing: if the proof were
    // refused the message would arrive truncated to the standard limit, and the tail would be gone.
    const TAIL_MARKER = 'OVERHANG-TAIL';
    const overhangMessage = 'x'.repeat(AT_PRO_THRESHOLD - TAIL_MARKER.length) + TAIL_MARKER;
    // At this length the countdown reads 200 under the Pro limit and would have appeared thousands of
    // characters ago under the standard one, so the value names which limit is being applied.
    await alice1.inputText(overhangMessage, new MessageInput(alice1), true);
    await alice1.waitForTextElementToBePresent(
      new MessageLengthCountdown(alice1, String(COUNTDOWN_START_THRESHOLD))
    );
    await alice1.clickOnElementAll(new SendButton(alice1));
    // The half a mocked proof cannot reach: the recipient VERIFIES the credential, so this only passes
    // if the proof is genuinely signed and still valid. With a mock the message arrives truncated to
    // the standard limit instead.
    // A long bubble collapses behind "Read more", and the hidden remainder is not in the accessibility
    // tree — so it has to be expanded before the tail can be read. OPPORTUNISTIC, because whether there
    // is anything to expand is itself the thing under test: a recipient that honoured the proof has
    // 9,800 characters and collapses; one that did not has 2,000 and shows no affordance at all.
    // 🔴 Android only, and the deviation is real rather than a workaround. Android puts a collapsed
    // bubble's remainder out of reach, so the tail has to be expanded before it can be read. iOS carries
    // the full text in the bubble's accessibility attributes whether it is collapsed or not, AND flattens
    // the bubble into a single accessibility element — so there is nothing to tap there and nothing to
    // gain by tapping it. Measured: an iOS id for this was added and compiled in, and still could not be
    // found in 20s. Attempting it on both platforms and swallowing the failure would spend that 20s every
    // run and disguise a genuine platform difference as a flaky locator.
    await runOnlyOnAndroid(platform, async () => {
      await bob1.waitForTextElementToBePresent({
        ...new MessageReadMore(bob1).build(),
        maxWait: 20_000,
      });
      await bob1.clickOnElementAll(new MessageReadMore(bob1));
    });
    await bob1.waitForMessageContaining(TAIL_MARKER, MESSAGE_DELIVERY_TIMEOUT_MS);
  });

  await test.step('Verify the plan displays as expired', async () => {
    // Back to the home screen first: unlike desktop's always-present left pane, mobile has no route to
    // settings from inside a conversation.
    await alice1.navigateBack();
    await alice1.clickOnElementAll(new UserSettings(alice1));
    await alice1.clickOnElementAll(new ProSettingsEntry(alice1));
    await alice1.waitForTextElementToBePresent(new ProRenewPlanRow(alice1));
    // The copy is asserted, not just the row, because the two are chosen by different code: a client
    // that fixed one and not the other offers to renew under a heading thanking the user for
    // subscribing.
    await alice1.waitForTextElementToBePresent(
      new ProSettingsDescription(alice1, tStripped('proAccessRenewStart'))
    );
    // Gated on an active plan, so their presence would mean the client is showing an active plan
    // rather than an expired one with working features.
    await alice1.verifyElementNotPresent({ ...new ProStatsHeader(alice1).build(), maxWait: 1000 });
    await alice1.verifyElementNotPresent({
      ...new ProManageSectionHeader(alice1).build(),
      maxWait: 1000,
    });
  });

  await closeApp(alice1, bob1);
}
