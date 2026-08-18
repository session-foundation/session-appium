import { LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { test_Alice_1W_pro_access } from '../../../desktop/sessionTest';
import { makeAccountPro } from '../../../shared/pro_grant';

/**
 * A Pro account assembled without the purchase UI, from the two halves that each need the other.
 *
 * The seeder writes the access expiry into config; the backend grants a real entitlement to the same
 * account. Neither is sufficient alone. A grant made out of band is invisible, because the startup gate
 * reads the access expiry FROM CONFIG to decide whether to ask `get_pro_status` — no expiry, no ask, and
 * nothing ever writes one. And the seeded expiry is not itself an entitlement, because the proof is
 * signed by the backend and no config write can forge it.
 *
 * The stats section is the assertion because it is gated on an ACTIVE PLAN, so it can only render from a
 * status the client fetched and a proof it actually holds — not from the value the seeder wrote.
 */
test_Alice_1W_pro_access('Pro is granted to a seeded account', async ({ alice, account }) => {
  // Before the client is allowed to look: the grant has to exist by the time the gate fires, and the
  // gate fires at startup.
  // No platform: desktop has none to derive a provider from, so the provider is given directly.
  await makeAccountPro({ user: account, provider: 'google' });

  // Desktop asks the backend for status only at startup, so the grant is invisible until it restarts.
  await restartApp(alice, { pro: {} });

  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.proMenuItem, { maxWait: 60_000 });
  await alice.waitForElement({ locator: ProSettings.statsHeader, options: { maxWaitMs: 60_000 } });
});
