import { CTA } from '../../../desktop/locators';
import { pinConversation, pinConversationConfirmed, pinIconFor } from '../../../desktop/pin';
import { dismissAnyProCTA } from '../../../desktop/pro_cta';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_10contacts } from '../../../desktop/sessionTest';
import { STANDARD_PIN_LIMIT } from '../../../shared/constants';
import { revokeAccountPro } from '../../../shared/pro_grant';
import { DESKTOP_PRO_CONTEXT } from '../../../shared/pro_revocation';

/**
 * One past the standard limit, pinned while Pro — the state this spec is about keeping.
 *
 * One is enough: the claim turns on holding *more* than a standard user may, and every pin beyond the
 * first over the limit costs a right-click without changing what is asserted.
 */
const PINS_WHILE_PRO = STANDARD_PIN_LIMIT + 1;

/**
 * The desktop half of "pins over the standard limit survive Pro being revoked".
 *
 * `pin_unpin_limit` covers the two static states — five for a standard user, more for a subscriber —
 * and no desktop spec crosses between them: of the six that call `revokeAccountPro`, none touches a pin.
 * So the transition is untested here, and it is the one a real subscriber goes through.
 *
 * Not a mirror of the mobile spec. Desktop selects its own CTA copy through
 * `UseTogglePinConversationHandler`, which picks `PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED` when the
 * user already holds more than the standard limit — a third implementation of the same two-axis choice
 * (over the limit × previously subscribed). iOS and Android agreeing on those tokens says nothing about
 * whether this one resolves them the same way.
 *
 * The rule is asymmetric and both halves are asserted: existing pins are **kept**, and adding another is
 * **refused**. A client that quietly unpinned the excess would be destroying user state, and the refusal
 * alone would pass against it.
 */
test_Alice_1W_10contacts(
  'Pins over the standard limit survive Pro being revoked',
  async ({ alice, contactNames }) => {
    const pinned = contactNames.slice(0, PINS_WHILE_PRO);
    const overLimit = contactNames[PINS_WHILE_PRO];

    await alice.subscribeToPro();
    await alice.waitForProActive();

    // Pinned only after the grant: doing it earlier would stop at the standard limit, which is the thing
    // being escaped.
    for (const name of pinned) {
      await pinConversationConfirmed(alice, name);
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    // `revokePayments: true` strips the entitlement as well as rotating the generation, so the client is
    // left holding a proof that is both revoked and unrenewable.
    await revokeAccountPro({ user: alice.getUser(), revokePayments: true });
    // A revocation is only real to a client that has fetched since it happened, and the backend serves the
    // production `retry_in`, so `DESKTOP_PRO_CONTEXT` forces the poll on the way back up.
    await restartApp(alice, DESKTOP_PRO_CONTEXT);
    // Losing Pro raises the expiry CTA off the status just fetched, so whether it is up races the poll
    // and it cannot be asserted. Left up it swallows the right-click below, which surfaces as a missing
    // "Pin" context-menu item several steps from the cause — and it would also satisfy a later check for
    // "a CTA is showing", so the pin CTA could pass without ever being raised.
    await dismissAnyProCTA(alice, 5_000);

    // Every pin is still there. Asserted before the refusal, because a client that had already dropped
    // the user back to five would satisfy the refusal below for the wrong reason.
    for (const name of pinned) {
      await pinIconFor(alice, name).waitFor({ state: 'visible' });
    }

    await pinConversation(alice, overLimit);
    // The renew variant, not the standard one: this account subscribed and lost it, and Desktop renders
    // `proRenewPinMoreConversations` for that case where a never-subscribed user gets the upsell copy.
    await alice.checkCTA('pinnedConversationsRenew');
    await alice.clickOn(CTA.cancelButton);

    // The CTA appearing is not the same as the pin being refused.
    await pinIconFor(alice, overLimit).waitFor({ state: 'hidden' });
  },
  { pro: {} }
);
