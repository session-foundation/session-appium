import type { StateUser } from '@session-foundation/qa-seeder';

export function shortenWithBrackets(str: string) {
  if (str.length <= 8) {
    return str;
  }

  return `(${str.slice(0, 4)}...${str.slice(str.length - 4)})`;
}

export function sortByPubkey(...users: Array<StateUser>) {
  return [...users]
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId))
    .map(user => user.userName);
}
