// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.
// The visual-regression cases compare against baselines under ./screenshots (see
// snapshotPathTemplate in playwright.config.ts) — regenerate them on the target platform
// with `--update-snapshots` if the desktop build's rendering differs.

import { Global, LeftPane, Settings } from '../../../desktop/locators';
import { compareElementScreenshot } from '../../../desktop/screenshot';
import { test_Alice_1W } from '../../../desktop/sessionTest';
import { assertUrlIsReachable, waitForTestIdWithText } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';
import { validateNetworkData } from '../../../shared/network_api';
import { sleepFor } from '../../../shared/promise_utils';

test_Alice_1W('Network page values', async ({ alice }) => {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.networkPageMenuItem);

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
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.networkPageMenuItem);
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  await sleepFor(65_000); // Wait 60+5 seconds to ensure timestamp changes to "1m ago"
  await alice.waitForTestIdWithText(Settings.lastUpdatedTimestamp.selector, oneMinAgoText);
  await alice.clickOn(Settings.refreshButton);
  await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
  await alice.waitForTestIdWithText(Settings.lastUpdatedTimestamp.selector, zeroMinAgoText);
});

// Cycle through all valid node counts and check count + graph
for (let nodeCount = 1; nodeCount <= 10; nodeCount++) {
  test_Alice_1W(
    `Network page with ${nodeCount}/dark`,
    async ({ alice }, testInfo) => {
      await alice.clickOn(LeftPane.settingsButton);
      await alice.clickOn(Settings.networkPageMenuItem);
      await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
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
    await alice.waitForLoadingAnimationToFinish(Global.loadingSpinner.selector);
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
