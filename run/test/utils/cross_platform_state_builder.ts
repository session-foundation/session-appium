import type { PrebuiltStateKey } from '@session-foundation/qa-seeder';

import type { IBaseDeviceWrapper } from '../../types/IBaseDeviceWrapper';
import type {
  AccountName,
  CrossPlatformSetup,
  CrossPlatformStateSetup,
  NamedAccountSpec,
} from './cross_platform';

/**
 * Account-name constants — the seeder's usernames lowercased. `satisfies` keeps them in
 * sync with `AccountName` (derived from the seeder's `UserNameType`): renaming/removing a
 * seeder username breaks this line. These are the keys the factories accept and that key
 * the clients handed to the test callback (`accounts.alice`, `accounts.bob`, …).
 */
export const ACCOUNT = {
  ALICE: 'alice',
  BOB: 'bob',
  CHARLIE: 'charlie',
} as const satisfies Record<string, AccountName>;

/**
 * Cross-platform counterpart to the mobile `run/test/state_builder`: named factory
 * functions that declare WHICH qa-seeder state to build and, per account, how many
 * clients of each platform to link to it.
 *
 * These are pure (no I/O): each returns a `CrossPlatformStateSetup` descriptor that
 * `crossPlatformTest` consumes to seed + open + link. Accounts map to the seeder's fixed
 * usernames in order (Alice → Bob → Charlie), and the same names key the clients handed
 * back to the test callback (`testCb: ({ accounts: { alice, bob } }) => …`).
 *
 * All account creation is seeder-based — no client is ever onboarded through the UI.
 */

/** Account-name unions each factory exposes (derived from the `ACCOUNT` constants). */
type TwoNames = typeof ACCOUNT.ALICE | typeof ACCOUNT.BOB;
type ThreeNames = TwoNames | typeof ACCOUNT.CHARLIE;

/** The two/three named accounts a multi-account setup accepts, keyed by seed username. */
type TwoNamed = Record<TwoNames, CrossPlatformSetup>;
type ThreeNamed = Record<ThreeNames, CrossPlatformSetup>;
/** Charlie optional — what the shared builder reads; the public overloads type it precisely. */
type UpToThreeNamed = TwoNamed & Partial<Record<typeof ACCOUNT.CHARLIE, CrossPlatformSetup>>;
type GroupOpts = { groupName: string; focusGroup?: boolean };

function buildSetup(
  accounts: UpToThreeNamed,
  twoKey: PrebuiltStateKey,
  threeKey: PrebuiltStateKey,
  group?: { groupName: string; focusGroup: boolean }
): CrossPlatformStateSetup<AccountName> {
  const specs: NamedAccountSpec[] = [
    { name: ACCOUNT.ALICE, platforms: accounts.alice },
    { name: ACCOUNT.BOB, platforms: accounts.bob },
  ];
  if (accounts.charlie) {
    specs.push({ name: ACCOUNT.CHARLIE, platforms: accounts.charlie });
  }
  return {
    stateKey: accounts.charlie ? threeKey : twoKey,
    groupName: group?.groupName,
    accounts: specs,
    names: specs.map(s => s.name),
    focusGroup: group?.focusGroup ?? false,
  };
}

/** One account ("alice") with several clients linked across platforms (qa-seeder `1user`). */
export function linkedDevices(
  platforms: CrossPlatformSetup
): CrossPlatformStateSetup<typeof ACCOUNT.ALICE> {
  return {
    stateKey: '1user',
    groupName: undefined,
    accounts: [{ name: ACCOUNT.ALICE, platforms }],
    names: [ACCOUNT.ALICE],
    focusGroup: false,
  };
}

/** Two/three mutual friends (qa-seeder `2friends`/`3friends`). */
export function friends(accounts: ThreeNamed): CrossPlatformStateSetup<ThreeNames>;
export function friends(accounts: TwoNamed): CrossPlatformStateSetup<TwoNames>;
export function friends(accounts: ThreeNamed | TwoNamed): CrossPlatformStateSetup<AccountName> {
  return buildSetup(accounts, '2friends', '3friends');
}

/** Two/three accounts with NO relationship (qa-seeder `2users`/`3users`). */
export function strangers(accounts: ThreeNamed): CrossPlatformStateSetup<ThreeNames>;
export function strangers(accounts: TwoNamed): CrossPlatformStateSetup<TwoNames>;
export function strangers(accounts: ThreeNamed | TwoNamed): CrossPlatformStateSetup<AccountName> {
  return buildSetup(accounts, '2users', '3users');
}

/** Two/three mutual friends already in a group (qa-seeder `2friendsInGroup`/`3friendsInGroup`). */
export function friendsInGroup(args: ThreeNamed & GroupOpts): CrossPlatformStateSetup<ThreeNames>;
export function friendsInGroup(args: TwoNamed & GroupOpts): CrossPlatformStateSetup<TwoNames>;
export function friendsInGroup(
  args: (ThreeNamed | TwoNamed) & GroupOpts
): CrossPlatformStateSetup<AccountName> {
  return buildSetup(args, '2friendsInGroup', '3friendsInGroup', {
    groupName: args.groupName,
    focusGroup: args.focusGroup ?? false,
  });
}

/**
 * Open `convoName` on every given client (platform-neutral, via `openConversationWith`).
 * The cross-platform equivalent of the mobile-only `focusConvoOnDevices`.
 */
export async function focusConvoCrossPlatform(
  clients: IBaseDeviceWrapper[],
  convoName: string
): Promise<void> {
  await Promise.all(clients.map(client => client.openConversationWith(convoName)));
}
