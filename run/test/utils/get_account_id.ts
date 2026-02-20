import { User } from '../../types/testing';
import { SupportedPlatformsType } from './open_app';

// Sorts users by pubkey hex and returns their usernames
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
