import { test, type TestInfo } from '@playwright/test';

import { TestSteps } from '../../types/allure';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  MarketCapAmount,
  SESHPrice,
  SessionNetworkMenuItem,
  StakingRewardPoolAmount,
} from '../locators/network_page';
import { UserSettings } from '../locators/settings';
import { newUser } from '../utils/create_account';
import { validateNetworkData } from '../utils/network_api';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Network page values',
  risk: 'medium',
  testCb: networkPageValues,
  countOfDevicesNeeded: 1,
  allureSuites: {
    parent: 'Network Page',
  },
  allureDescription:
    'Verifies that the Session Network Page displays the values fetched from the network API correctly.',
});

async function networkPageValues(platform: SupportedPlatformsType, testInfo: TestInfo) {
  let data: {
    price: { usd: number; usd_market_cap: number };
    token: { staking_reward_pool: number };
  };

  const { device } = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
    await newUser(device, USERNAME.ALICE, { saveUserData: false });
    return { device };
  });

  await test.step(TestSteps.OPEN.GENERIC('Session Network Page'), async () => {
    await device.clickOnElementAll(new UserSettings(device));
    await device.clickOnElementAll(new SessionNetworkMenuItem(device));
  });

  await test.step('Fetch and validate Network API data', async () => {
    const response = await fetch('http://networkv1.getsession.org/info');
    if (!response.ok) {
      throw new Error(`Network API returned ${response.status}`);
    }
    data = await response.json();
    validateNetworkData(data);

    console.log(`Price: ${data.price.usd}`);
    console.log(`Staking Reward Pool: ${data.token.staking_reward_pool}`);
    console.log(`Market Cap: ${data.price.usd_market_cap}`);
  });

  await test.step('Verify SESH price is displayed correctly', async () => {
    await device.waitForTextElementToBePresent(new SESHPrice(device, data.price.usd));
  });

  await test.step('Verify Staking Reward Pool is displayed correctly', async () => {
    await device.waitForTextElementToBePresent(
      new StakingRewardPoolAmount(device, data.token.staking_reward_pool)
    );
  });

  await test.step('Verify Market Cap is displayed correctly', async () => {
    await device.waitForTextElementToBePresent(
      new MarketCapAmount(device, data.price.usd_market_cap)
    );
  });

  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(device);
  });
}
