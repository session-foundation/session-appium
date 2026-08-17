import { Conversation, LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { test_Alice_1W_Bob_1W } from '../../../desktop/sessionTest';

const PRO_MAX_CHARS = 10000;
const COUNTDOWN_START_THRESHOLD = 200;
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
test_Alice_1W_Bob_1W(
  'Pro features survive the plan expiring',
  async ({ alice, bob }) => {
    await alice.createContactWith(bob);
    await alice.openConversationWith(bob.userName);

    // At this length the countdown reads 200 under the Pro limit and would have appeared thousands of
    // characters ago under the standard one, so the value names which limit is being applied.
    await alice.pasteIntoInput('message-input-text-area', 'z'.repeat(AT_PRO_THRESHOLD));
    await alice.waitForElement({
      locator: Conversation.tooltipCharacterCount,
      options: { text: String(COUNTDOWN_START_THRESHOLD) },
    });

    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);
    await alice.waitForElement({ locator: ProSettings.renewPlanButton });
    // Gated on the plan being active, so their presence would mean the client is showing an active plan
    // rather than an expired one whose features still work.
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.statsHeader);
    await alice.hasElementPoppedUpThatShouldnt(ProSettings.planExpiry);
  },
  {
    // The plan is over and the backend has said so, while the credential it was issued under is still
    // good. No expiry and no loading state: the expired screen renders from the status alone here, and
    // adding either would arm a CTA this spec is not about. The mobile spec needs both because its
    // settings screen and its app-open CTA require a confirmed status.
    pro: { proBackendStatus: 'expired', proProof: 'valid' },
  }
);
