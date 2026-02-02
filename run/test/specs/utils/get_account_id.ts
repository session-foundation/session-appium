import { type StateUser } from '@session-foundation/qa-seeder';

import { User } from '../../../types/testing';
import { SupportedPlatformsType } from './open_app';

// Sorts users by pubkey hex (StateUser.sessionId from qa-seeder or User.accountID from local types) and returns usernames
export function sortByPubkey(...users: Array<StateUser | User>) {
  return [...users]
    .sort((a, b) => {
      const aKey = 'accountID' in a ? a.accountID : String(a.sessionId);
      const bKey = 'accountID' in b ? b.accountID : String(b.sessionId);
      return aKey.localeCompare(bKey);
    })
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
