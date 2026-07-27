// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { CTA } from '../../../desktop/locators';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { reloadWindow, verifyNoCTAShows } from '../../../desktop/utils';
import { mockDBCreationTime } from '../../../shared/mock_time';

async function verifyDonateCTAShows(alice: DesktopWrapper) {
  // Uses the cross-platform CTA config table (run/types/cta.ts) shared with the mobile suite.
  await alice.checkCTA('donate');
}

test_Alice_1W(
  'Donate CTA, DB age >= 7 days, max 4 times',
  async ({ alice }) => {
    const MAX_DONATE_CTA_SHOWS = 4;

    // Check CTA appears for the first MAX_DONATE_CTA_SHOWS times
    for (let i = 0; i < MAX_DONATE_CTA_SHOWS; i++) {
      await verifyDonateCTAShows(alice);
      await reloadWindow(alice.getPage());
    }

    // Verify CTA doesn't appear after MAX_DONATE_CTA_SHOWS reloads
    await verifyNoCTAShows(alice.getPage());
  },
  {
    dbCreationTimestampMs: mockDBCreationTime({
      days: -7,
      minutes: -2,
    }),
  }
);

test_Alice_1W(
  'Donate CTA, DB age < 7 days',
  async ({ alice }) => {
    await verifyNoCTAShows(alice.getPage());
  },
  {
    dbCreationTimestampMs: mockDBCreationTime({
      days: -6,
      hours: -23,
      minutes: -58,
    }),
  }
);

test_Alice_1W(
  `Donate CTA, never shows after 'Read Appeal'`,
  async ({ alice }) => {
    // First time: CTA should appear
    await verifyDonateCTAShows(alice);
    // Note: This spawns a system browser outside Playwright's control
    await alice.clickOn(CTA.confirmButton);
    // Reload and verify CTA never appears again
    await reloadWindow(alice.getPage());
    await verifyNoCTAShows(alice.getPage());
  },
  {
    dbCreationTimestampMs: mockDBCreationTime({
      days: -7,
      minutes: -2,
    }),
  }
);
