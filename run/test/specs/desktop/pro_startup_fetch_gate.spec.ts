import { CTA, LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { EXPIRING_SOON_ENTITLEMENT_SECONDS, makeAccountPro } from '../../../shared/pro_grant';

/**
 * Both halves of the cold-launch status fetch, against a **real grant** — the one thing a display mock
 * cannot cover, because the mocked path confirms a status without going near the gate that decides
 * whether to trust one.
 *
 * The client only goes to the network at launch when a CTA could fire, computed from what synced config
 * already knows. An account with no access expiry and no proof is never fetched for, which is what stops
 * a warning being raised off state the client has not confirmed.
 *
 * A grant minted straight into the backend is exactly that account, so the first launch must stay
 * silent. Opening Pro settings fetches regardless and stores the expiry — the state an in-app purchase
 * would have written — so the launch after it is a returning subscriber's, and must warn.
 *
 * This could not run on Desktop until the CTAs stopped being gated on `fromAppStart`: that suppressed
 * the second half unconditionally, so the same user-visible rule was unobservable here while it was
 * asserted on both mobile clients. The rule is now the same on all three and reached differently — the
 * CTA appears once the status is confirmed rather than at the moment of launch.
 */
test_Alice_1W(
  'Pro startup fetch gate arms the expiring soon CTA',
  async ({ alice }) => {
    // Minted directly rather than through `subscribeToPro`, which grants the mint's default duration:
    // this spec needs a subscriber who is ALREADY inside the expiring-soon window.
    const account = alice.getUser();
    await makeAccountPro({
      user: {
        userName: account.userName,
        accountID: account.accountid,
        recoveryPhrase: account.recoveryPassword,
      },
      provider: 'google',
      durationSeconds: EXPIRING_SOON_ENTITLEMENT_SECONDS,
    });

    await restartApp(alice, { pro: {} });
    // Long enough that a fetch which DID happen would have answered by now. A short window would pass
    // whether the gate held or not, which is the failure mode this assertion exists to avoid.
    await alice.hasElementPoppedUpThatShouldnt(CTA.heading);

    // Opening Pro settings fetches regardless of the gate, and stores what it learns.
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);
    await alice.waitForElement({ locator: ProSettings.statsHeader });

    await restartApp(alice, { pro: {} });
    await alice.checkCTA('proExpiringSoon');
  },
  // `pro: {}` turns the Pro surfaces on and mocks NOTHING. Passed to each restart too — the mocks are
  // launch env, so a restart without it comes back up with Pro switched off entirely. A status mock would call the confirmation
  // directly, satisfying the CTA guard without the gate ever being consulted — which is the thing under
  // test. It also tags this `@pro`.
  { pro: {} }
);
