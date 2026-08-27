import { LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { sessionTestTwoWindows } from '../../../desktop/sessionTest';

/**
 * The reinstall case: pay, lose the install, restore, still Pro.
 *
 * A **real grant**, never a display mock. Pro-ness has to survive a client that has never seen it —
 * the restored install derives the Pro master key from the recovery phrase and asks the backend, so
 * this exercises that derivation end to end. A mock would only convince the client that already had
 * it, which is the opposite of what is being tested.
 *
 * Two independent windows rather than a linked device: nothing is carried across from the first, only
 * the phrase, which is exactly what a user has after losing their machine.
 */
sessionTestTwoWindows(
  'Pro survives a restore from seed',
  async ([alice, restored]) => {
    const account = await alice.onboard('Alice');

    await alice.subscribeToPro();
    await alice.waitForProActive();

    // The account is seconds old, so its profile may not have reached the network yet and the
    // restore prompts for a name. This spec asserts entitlement, not the display name.
    await restored.restoreFromSeed(account.seedPhrase, 'Alice');

    // The stats section is gated on an active plan, so its presence is the restored client having
    // fetched a real entitlement rather than merely rendering a Pro screen.
    await restored.clickOn(LeftPane.settingsButton);
    await restored.clickOn(Settings.proMenuItem, { maxWait: 60_000 });
    await restored.waitForElement({
      locator: ProSettings.statsHeader,
      options: { maxWaitMs: 60_000 },
    });
  },
  { pro: {} }
);
