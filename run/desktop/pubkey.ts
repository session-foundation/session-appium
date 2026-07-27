import { User } from './types';

export function shortenWithBrackets(str: string) {
  if (str.length <= 8) {
    return str;
  }

  return `(${str.slice(0, 4)}...${str.slice(str.length - 4)})`;
}

export function sortByPubkey(...users: Array<User>) {
  return [...users]
    .sort((a, b) => a.accountid.localeCompare(b.accountid))
    .map(user => user.userName);
}
