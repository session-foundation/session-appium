import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Conversation, CTA, LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_Bob_1W_friends } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';
import {
  COUNTDOWN_START_THRESHOLD,
  MESSAGE_DELIVERY_TIMEOUT_MS,
  PRO_MAX_CHARS,
} from '../../../shared/constants';
import { sleepFor } from '../../../shared/promise_utils';

/** Lands the countdown on exactly the threshold, so the value asserted is the limit being applied. */
const AT_PRO_THRESHOLD = PRO_MAX_CHARS - COUNTDOWN_START_THRESHOLD;

/**
 * The one disagreement between the two Pro values that is a feature.
 *
 * Access comes from the proof; the displayed state comes from the plan. When a plan lapses the proof does
 * not expire with it, so there is a window where the client shows "expired" and still serves every Pro
 * feature — deliberate, and the reason the two values exist separately at all.
 *
 * Asserted together in one launch on purpose. Each half alone is satisfied by a client that has collapsed
 * the two values back into one: a client reading only the proof shows Active and passes the feature
 * check, and a client reading only the plan shows expired and passes the display check. Only the pair
 * fails for a client that has lost the distinction — which is the regression worth catching, because it
 * is silent and it takes a paid-for feature away from someone still entitled to it.
 *
 * Found exactly that on Android the first time it ran: the composer applied the standard limit while the
 * settings screen correctly said expired.
 *
 * The composer half runs first so the settings screen can be the last thing opened and nothing has to be
 * navigated back out of.
 */
/** Clear a Pro CTA if one is up. Not an assertion — this spec is about the state behind the modal. */
async function dismissAnyProCTA(window: DesktopWrapper, waitMs: number) {
  const cancel = window
    .getPage()
    .locator(`[${CTA.cancelButton.strategy}="${CTA.cancelButton.selector}"]`)
    .first();
  await cancel.waitFor({ state: 'visible', timeout: waitMs }).catch(() => undefined);
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await cancel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }
}

test_Alice_1W_Bob_1W_friends(
  'Pro features survive the plan expiring',
  async ({ alice, bob }) => {
    // A REAL grant, one second long. The account lapses before the client can read its status, so the
    // FIRST fetch already sees the overhang - no waiting for an expiry and no second restart. The
    // backend keeps certifying proofs for a lapsed account until its coverage runs out (~25h past the
    // true expiry), and one second in is comfortably inside that; if that over-provision were ever
    // shortened, this spec is what would notice.
    // Long enough for a restart and a status fetch to land while the plan is still live — measured at
    // ~4s — with room for a loaded host. The wait below runs to a deadline measured from the grant, so
    // raising this does not add to the run twice.
    const PLAN_SECONDS = 12;
    const grantedAt = Date.now();
    await alice.subscribeToPro(undefined, { durationSeconds: PLAN_SECONDS });
    // Desktop asks the backend for status only at startup, so the grant is invisible until it restarts.
    await restartApp(alice, { pro: {} });
    // Cheap opportunistic clear. A short, non-renewing grant CAN arm a Pro CTA, but observed behaviour
    // is that it arms on entering the Pro settings screen rather than on launch — so this does not wait
    // around for one, and the real clear is at the settings step below.
    await dismissAnyProCTA(alice, 2_000);
    // Active FIRST: the client has to hold a proof before the plan lapses, because a fetch that finds an
    // already-expired plan does not leave it with a credential to survive on.
    await alice.waitForProActive();
    // Then let the plan lapse and read the status again. The proof it is already holding stays valid for
    // the whole coverage window, so what changes is the plan, not the entitlement.
    //
    // To a DEADLINE from the grant rather than a fresh countdown: the time already spent reaching Active
    // is time the plan was already burning, and sleeping the full length again doubled the run for
    // nothing.
    const lapsedAt = grantedAt + (PLAN_SECONDS + 2) * 1000;
    await sleepFor(Math.max(0, lapsedAt - Date.now()));
    await restartApp(alice, { pro: {} });
    await dismissAnyProCTA(alice, 2_000);
    // The relaunch lands on the conversation list, not in the conversation the fixture had open.
    await alice.openConversationWith(bob.userName);

    const overhangMessage = 'z'.repeat(AT_PRO_THRESHOLD);
    await alice.pasteIntoInput('message-input-text-area', overhangMessage);
    // At this length the countdown reads 200 under the Pro limit and would have appeared thousands of
    // characters ago under the standard one, so the value names which limit is being applied.
    await alice.waitForElement({
      locator: Conversation.tooltipCharacterCount,
      options: { text: String(COUNTDOWN_START_THRESHOLD) },
    });

    await alice.sendMessage(overhangMessage);
    await alice.waitForMessage(overhangMessage);
    // The half a mocked proof can never reach: a recipient VERIFIES the credential, so this only passes
    // if the proof is genuinely signed and genuinely still valid. Measured with a mock, Bob receives the
    // first 2000 characters instead. Generous wait because this is the largest message the product
    // allows and it crosses the network.
    await bob.waitForMessage(overhangMessage, MESSAGE_DELIVERY_TIMEOUT_MS);

    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);
    // Where it actually arms: entering Pro settings on a short, non-renewing grant raises the
    // expiring/expired CTA over the screen. Waited for here — and only here — because clearing it is a
    // precondition for reading the copy, not the subject. `pro_expiring_soon_cta` asserts the CTA.
    await dismissAnyProCTA(alice, 20_000);
    await alice.waitForElement({ locator: ProSettings.renewPlanButton });
    // The copy is asserted, not just the row, because the two are chosen by different code. The button
    // follows the plan's status; the hero description is picked by a separate switch on that same
    // status, so a client that fixed one and not the other offers to renew under a heading thanking the
    // user for subscribing.
    await alice.waitForElement({
      locator: ProSettings.description,
      options: { text: tStripped('proAccessRenewStart') },
    });
    // Gated on the plan being active, so their presence would mean the client is showing an active plan
    // rather than an expired one whose features still work.
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.statsHeader);
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.planExpiry);
  },
  // Tags the test `@pro`; the state itself comes from the grant above, not from a mock.
  { pro: {} }
);
