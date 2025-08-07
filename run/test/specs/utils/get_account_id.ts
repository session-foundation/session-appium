import { DeviceWrapper } from '../../../types/DeviceWrapper';
import { User } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';

export const saveSessionIdIos = async (device: DeviceWrapper) => {
  const selector = await device.grabTextFromAccessibilityId('Session ID generated');
  return selector;
};

export const getAccountId = async (device: DeviceWrapper) => {
  const AccountId = await device.grabTextFromAccessibilityId('Account ID');

  return AccountId;
};

export function sortByPubkey(...users: Array<User>) {
  return [...users]
    .sort((a, b) => a.accountID.localeCompare(b.accountID))
    .map(user => user.userName);
}

export function truncatePubkey(pubkey: string, platform: SupportedPlatformsType) {
  // Take first 4 and last 4 characters
  const start = pubkey.substring(0, 4);
  const end = pubkey.substring(pubkey.length - 4);

  // Use platform-appropriate ellipsis
  const ellipsis = platform === 'ios' ? '...' : '…';

  return `${start}${ellipsis}${end}`;
}
