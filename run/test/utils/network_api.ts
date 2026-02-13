import { isFinite } from 'lodash';

export type NetworkData = {
  price: { usd: number; usd_market_cap: number };
  token: { staking_reward_pool: number };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && isFinite(n) && n > 0;
}

export function validateNetworkData(data: unknown): asserts data is NetworkData {
  if (!isObject(data)) {
    throw new Error('Invalid network API response: not an object');
  }

  if (!isObject(data.price) || !isObject(data.token)) {
    throw new Error('Invalid network API response: missing price or token');
  }

  if (
    !isPositiveFiniteNumber(data.price.usd) ||
    !isPositiveFiniteNumber(data.price.usd_market_cap) ||
    !isPositiveFiniteNumber(data.token.staking_reward_pool)
  ) {
    throw new Error('Invalid network API response: numeric fields must be positive and finite');
  }
}
