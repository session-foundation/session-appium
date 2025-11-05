import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import {
  MarketCapAmount,
  SESHPrice,
  SessionNetworkMenuItem,
  StakingRewardPoolAmount,
} from './locators/network_page';
import { UserSettings } from './locators/settings';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Network page values',
  risk: 'medium',
  testCb: networkPageValues,
  countOfDevicesNeeded: 1,
});

function validateNetworkData(data: any): asserts data is {
  price: { usd: number; usd_market_cap: number };
  token: { staking_reward_pool: number };
} {
  if (
    typeof data?.price?.usd !== 'number' ||
    typeof data?.token?.staking_reward_pool !== 'number' ||
    typeof data?.price?.usd_market_cap !== 'number'
  ) {
    throw new Error('Network API response missing or invalid numeric fields');
  }
}

async function networkPageValues(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device } = await openAppOnPlatformSingleDevice(platform, testInfo);
  await newUser(device, USERNAME.ALICE, { saveUserData: false });
  await device.clickOnElementAll(new UserSettings(device));
  await device.clickOnElementAll(new SessionNetworkMenuItem(device));

  const response = await fetch('http://networkv1.getsession.org/info');
  if (!response.ok) {
    throw new Error(`Network API returned ${response.status}`);
  }
  const data = await response.json();
  validateNetworkData(data);

  // SESH Price
  await device.waitForTextElementToBePresent(new SESHPrice(device, data.price.usd));

  // Staking Reward Pool
  await device.waitForTextElementToBePresent(
    new StakingRewardPoolAmount(device, data.token.staking_reward_pool)
  );

  // Market Cap
  await device.waitForTextElementToBePresent(
    new MarketCapAmount(device, data.price.usd_market_cap)
  );

  await closeApp(device);
}
