import { CTA, LeftPane, ProSettings, Settings } from '../../../desktop/locators';
import { restartApp } from '../../../desktop/restart';
import { sessionTestOneWindow } from '../../../desktop/sessionTest';

const EXPIRING_SOON = {
  proBackendStatus: 'active',
  proAccessExpiry: 'PT23H59M',
  autoRenewing: false,
  // Load-bearing: the CTA arms only on a confirmed status fetch, which a mocked expiry alone is not.
  proLoadingState: 'success',
} as const;

/**
 * The warning a subscriber gets as their access approaches its end — the one thing standing between
 * someone who meant to renew and someone who silently lapses.
 *
 * Mocked rather than granted, because the subject is what the client *shows* and where: a subscriber is
 * warned on the launch that finds them expiring, with no detour through settings first. Whether the
 * client was right to trust the state it warned off is the fetch gate's business, and the mobile
 * `pro_startup_fetch_gate` spec covers that against a real grant with no mocks at all.
 *
 * `autoRenewing: false` is required, not incidental: the expiring-soon branch only arms for a plan that
 * will NOT renew itself, which is the only case where the user has to act.
 *
 * The expiry sits just inside 24 hours rather than at a round number of days because the window check is
 * strict (`sevenDaysBeforeExpiry < now`), so a seven-day expiry lands exactly on the boundary and arms
 * nothing. It renders as "2 days" — the duration ceilings into units.
 */
sessionTestOneWindow(
  'Pro expiring soon CTA',
  async ([alice]) => {
    await alice.onboard('Alice');
    // Onboarded before the mock is applied, then restarted into it. Desktop arms the CTA at startup
    // rather than after the swarm is ready, so a launch-time mock fires mid-onboarding and covers the
    // recovery-phrase step; this is also the real shape, a subscriber opening the app.
    await restartApp(alice, { pro: EXPIRING_SOON });

    await alice.checkCTA('proExpiringSoon');
    await alice.clickOn(CTA.cancelButton);

    // The warning is about access ENDING, not access ended: dismissing it must leave a subscriber
    // looking like a subscriber, and the stats section is gated on the plan being active.
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.proMenuItem);
    await alice.waitForElement({ locator: ProSettings.statsHeader });
  },
  // Tags the test `@pro` without arming anything before onboarding is done.
  { pro: {} }
);
