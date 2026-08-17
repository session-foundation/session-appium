// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.
// The visual-regression cases compare against baselines under ./screenshots (see
// snapshotPathTemplate in playwright.config.ts) — regenerate them on the target platform
// with `--update-snapshots` if the desktop build's rendering differs.

import type { Page } from '@playwright/test';

import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { compareElementScreenshot } from '../../../desktop/screenshot';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import {
  assertUrlIsReachable,
  buildSelectorEscapeText,
  waitForTestIdWithText,
} from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';
import { validateNetworkData } from '../../../shared/network_api';
import { sleepFor } from '../../../shared/promise_utils';

// How long to give one fetch of the network data before deciding it is not coming.
const NETWORK_DATA_WAIT_MS = 20_000;
// How many times to press refresh after that. Each press is a fresh fetch, so this is retries of
// the request, not of the wait.
const NETWORK_DATA_REFRESH_ATTEMPTS = 3;

/**
 * Whether the Session Network page has data, waiting up to `maxWaitMs` for it.
 *
 * Returns a boolean rather than throwing because both callers want to *decide* on the answer:
 * `waitForNetworkData` retries, the refresh test fails.
 *
 * Not `waitForLoadingAnimationToFinish`: that throws on a spinner that never clears, and it keys off
 * the spinner alone. This needs a boolean, and needs the refresh button as proof the page mounted.
 */
async function networkDataLoaded(window: Page, maxWaitMs: number): Promise<boolean> {
  const spinner = buildSelectorEscapeText(Global.loadingSpinner);
  const refreshButton = buildSelectorEscapeText(Settings.refreshButton);
  const start = Date.now();

  do {
    // The refresh button is what proves the page has rendered at all. Without it, "no spinner
    // visible" also answers yes for the frames before the page mounts, and we would report loaded
    // before anything had been drawn.
    if ((await window.isVisible(refreshButton)) && !(await window.isVisible(spinner))) {
      return true;
    }
    await sleepFor(500);
  } while (Date.now() - start < maxWaitMs);

  return false;
}

/**
 * Wait for the network data, pressing refresh if it doesn't arrive.
 *
 * The page renders the same spinner whether the data is loading or the fetch produced nothing:
 * `NodesStats` spins on `dataIsStale`, and `useDataIsStale()` is `now > (price.t_stale ?? 0)`, which
 * is true whenever nothing has ever been fetched. So a failed fetch is indistinguishable from a slow
 * one, and it never resolves on its own — nothing schedules a retry.
 *
 * It fails often enough to matter on devnet. Opening the page does dispatch a refresh
 * (`DefaultSettingsPage`, on the menu item we just clicked), but that delegates to
 * `fetchInfoFromSeshServer`, which throws `already loading` if a fetch is in flight — and startup
 * fires one as soon as our swarm resolves (`startup.ts`). The app comes up fast here, so the two race
 * and the open-time refresh is dropped; if the startup one then fails, the page is left with no data
 * and no pending request. `/info` is a real onion request to production networkv1.getsession.org
 * routed over devnet snodes, which is exactly the fetch most likely to fail early in a run.
 *
 * Pressing refresh is what a human does to get out of it, and it works because by then nothing is in
 * flight. Playwright's actionability check covers the rest: the button is `disabled` while loading,
 * so the click waits for the in-flight fetch instead of being swallowed by it.
 */
async function waitForNetworkData(alice: DesktopWrapper): Promise<void> {
  const window = alice.getPage();

  // The initial load, then one wait per refresh. Structured this way so every refresh is actually
  // waited on: looping `attempt <= ATTEMPTS` around "wait then refresh" pressed refresh one extra
  // time and threw immediately after the last press, without ever giving it a chance.
  if (await networkDataLoaded(window, NETWORK_DATA_WAIT_MS)) {
    return;
  }

  for (let attempt = 1; attempt <= NETWORK_DATA_REFRESH_ATTEMPTS; attempt++) {
    console.info(
      `Session Network page still has no data after ${NETWORK_DATA_WAIT_MS}ms, pressing refresh ` +
        `(attempt ${attempt}/${NETWORK_DATA_REFRESH_ATTEMPTS})`
    );
    await alice.clickOn(Settings.refreshButton);
    if (await networkDataLoaded(window, NETWORK_DATA_WAIT_MS)) {
      return;
    }
  }

  throw new Error(
    `The Session Network page never loaded its data: the initial load plus ` +
      `${NETWORK_DATA_REFRESH_ATTEMPTS} refreshes, ${NETWORK_DATA_WAIT_MS}ms each, all left it on ` +
      `the spinner. Check the desktop log for "[networkData/fetchInfoFromSeshServer] rejected" — ` +
      `/info goes to networkv1.getsession.org over an onion path, so this is usually the request ` +
      `failing rather than the page.`
  );
}

/** Settings -> Session Network, with its data loaded. */
async function openNetworkPage(alice: DesktopWrapper): Promise<void> {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.networkPageMenuItem);
  await waitForNetworkData(alice);
}

test_Alice_1W('Network page values', async ({ alice }) => {
  await openNetworkPage(alice);

  const response = await fetch('http://networkv1.getsession.org/info');
  if (!response.ok) {
    throw new Error(`Network API returned ${response.status}`);
  }
  const data = await response.json();
  validateNetworkData(data);

  // SESH Price - 2 decimals "$1.23 USD"
  const seshPrice = `$${data.price.usd.toFixed(2)} USD`;

  // Staking Reward Pool - whole number with commas "1,234,567 SESH"
  const stakingRewardPool = `${data.token.staking_reward_pool.toLocaleString('en-US')} SESH`;

  // Market Cap - round to whole number with commas, "$1,234,567 USD"
  const marketCap = `$${Math.round(data.price.usd_market_cap).toLocaleString('en-US')} USD`;

  await alice.waitForTestIdWithText(Settings.seshPrice.selector, seshPrice);
  await alice.waitForTestIdWithText(Settings.stakingRewardPoolAmount.selector, stakingRewardPool);
  await alice.waitForTestIdWithText(Settings.marketCapAmount.selector, marketCap);
});

test_Alice_1W('Network page network link', async ({ alice }) => {
  const url = 'https://docs.getsession.org/session-network';
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.networkPageMenuItem);
  await alice.clickOn(Settings.learnMoreNetworkLink);
  await alice.checkModalStrings(
    tStripped('urlOpen'),
    tStripped('urlOpenDescription', { url }),
    'openUrlModal'
  );
  await assertUrlIsReachable(url);
});

test_Alice_1W('Network page staking link', async ({ alice }) => {
  const url = 'https://docs.getsession.org/session-network/staking';
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.networkPageMenuItem);
  await alice.clickOn(Settings.learnMoreAboutStakingLink);
  await alice.checkModalStrings(
    tStripped('urlOpen'),
    tStripped('urlOpenDescription', { url }),
    'openUrlModal'
  );
  await assertUrlIsReachable(url);
});

test_Alice_1W('Network page refresh', async ({ alice }) => {
  const zeroMinAgoText = tStripped('updated', { relative_time: '0m' });
  const oneMinAgoText = tStripped('updated', { relative_time: '1m' });
  await openNetworkPage(alice);
  await sleepFor(65_000); // Wait 60+5 seconds to ensure timestamp changes to "1m ago"
  await alice.waitForTestIdWithText(Settings.lastUpdatedTimestamp.selector, oneMinAgoText);
  await alice.clickOn(Settings.refreshButton);
  // Deliberately not `waitForNetworkData`: this is the test of the refresh button, so a press that
  // doesn't bring the data back has to fail rather than be retried away.
  if (!(await networkDataLoaded(alice.getPage(), NETWORK_DATA_WAIT_MS))) {
    throw new Error(
      `The refresh button left the page on the spinner after ${NETWORK_DATA_WAIT_MS}ms`
    );
  }
  await alice.waitForTestIdWithText(Settings.lastUpdatedTimestamp.selector, zeroMinAgoText);
});

// Cycle through all valid node counts and check count + graph
for (let nodeCount = 1; nodeCount <= 10; nodeCount++) {
  test_Alice_1W(
    `Network page with ${nodeCount}/dark`,
    async ({ alice }, testInfo) => {
      await openNetworkPage(alice);
      await alice.waitForTestIdWithText(Settings.yourSwarmAmount.selector, String(nodeCount));

      const swarmImageContainer = await waitForTestIdWithText(
        alice.getPage(),
        Settings.swarmImage.selector
      );

      await compareElementScreenshot({
        element: swarmImageContainer,
        snapshotName: `swarm-${nodeCount}-node-dark.jpeg`,
        testInfo,
        maxRetryDurationMs: 5_000,
      });
    },
    {
      networkPageNodeCount: nodeCount,
    }
  );
}

// 7 has been chosen as it's the most common swarm size
// Single check to verify light mode svg also renders correctly
const LIGHT_THEME_TEST_NODE_COUNT = 7;
test_Alice_1W(
  `Network page with ${LIGHT_THEME_TEST_NODE_COUNT}/light`,
  async ({ alice }, testInfo) => {
    await alice.clickOn(LeftPane.settingsButton);
    await alice.clickOn(Settings.appearanceMenuItem);
    await alice.clickOn(Settings.oceanLightOption);
    await alice.clickOn(Global.modalBackButton);
    await alice.clickOn(Settings.networkPageMenuItem);
    await waitForNetworkData(alice);
    await alice.waitForTestIdWithText(
      Settings.yourSwarmAmount.selector,
      String(LIGHT_THEME_TEST_NODE_COUNT)
    );

    const nodeImageContainer = await waitForTestIdWithText(
      alice.getPage(),
      Settings.swarmImage.selector
    );

    await compareElementScreenshot({
      element: nodeImageContainer,
      snapshotName: `swarm-${LIGHT_THEME_TEST_NODE_COUNT}-node-light.jpeg`,
      testInfo,
      maxRetryDurationMs: 5_000,
    });
  },
  {
    networkPageNodeCount: LIGHT_THEME_TEST_NODE_COUNT,
  }
);
