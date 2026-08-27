import { Agent, setGlobalDispatcher } from 'undici';

// Force IPv4 connections to work around Node.js fetch/undici lacking "Happy Eyeballs" (RFC 6555)
// https://github.com/node-fetch/node-fetch/issues/1297
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

import type { TestInfo } from '@playwright/test';

import {
  buildStateForTest,
  type BuildStateOptions,
  type PinSeedOptions,
  type PrebuiltStateKey,
  type StateUser,
  type WithGroupStateKey,
} from '@session-foundation/qa-seeder';

import type { DeviceWrapper } from '../../types/DeviceWrapper';

import { ConversationItem } from '../locators/home';
import { resolveNetworkTarget } from '../utils/devnet';
import { openAppMultipleDevices, type SupportedPlatformsType } from '../utils/open_app';
import { MobileTestContext, MobileTestContexts } from '../utils/pro_context';
import { restoreAccountNoFallback } from '../utils/restore_account';

type WithAlice = { alice: StateUser };
type WithBob = { bob: StateUser };
type WithCharlie = { charlie: StateUser };
type WithDracula = { dracula: StateUser };

type WithFocusFriendsConvo = { focusFriendsConvo: boolean };
type WithFocusGroupConvo = { focusGroupConvo: boolean };
type WithPlatform = { platform: SupportedPlatformsType };

export type AppCountPerTest = 1 | 2 | 3 | 4;

type WithUsers<C extends AppCountPerTest> = C extends 4
  ? WithAlice & WithBob & WithCharlie & WithDracula
  : C extends 3
    ? WithAlice & WithBob & WithCharlie
    : C extends 2
      ? WithAlice & WithBob
      : C extends 1
        ? WithAlice
        : never;

/**
 * Focus either a specific conversation for all devices (group for instance)
 * or a different conversation on each device
 */
async function focusConvoOnDevices(
  args:
    | Array<{ device: DeviceWrapper; convoName: string }>
    | { devices: Array<DeviceWrapper>; convoName: string }
) {
  // single array of devices was given. That means we want to focus a different convo for each device
  if (Array.isArray(args)) {
    await Promise.all(
      args.map(({ device, convoName }) =>
        device.clickOnElementAll(new ConversationItem(device, convoName))
      )
    );
    return;
  }
  await Promise.all(
    args.devices.map(async device => {
      return device.clickOnElementAll(new ConversationItem(device, args.convoName));
    })
  );
}

async function linkDevices(devices: Array<DeviceWrapper>, seedPhrases: Array<string>) {
  if (seedPhrases.length !== devices.length) {
    throw new Error(`Seed phrases and devices length mismatch`);
  }
  await Promise.all(
    devices.map(async (device, index) => {
      const seedPhrase = seedPhrases[index];
      if (!seedPhrase) {
        throw new Error(`Missing seed phrase`);
      }
      return restoreAccountNoFallback(device, seedPhrase);
    })
  );
}

/**
 * A is the count of apps to open (between 1 and 4)
 * K is the state to build (for instance '2friends', '3friendsInGroup', ...)
 */
async function openAppsWithState<A extends 1 | 2 | 3 | 4, K extends PrebuiltStateKey>({
  appsToOpen,
  platform,
  groupName,
  stateToBuildKey,
  stateOptions,
  testInfo,
  testContext,
}: WithPlatform & {
  appsToOpen: A;
  stateToBuildKey: K;
  groupName: K extends WithGroupStateKey ? string : undefined;
  /**
   * The seeder's per-user knobs (Pro access, pinned conversations), addressed by a user's index in the
   * state's user list. They compose with every state key, so they are threaded through rather than
   * selected by `stateToBuildKey`.
   */
  stateOptions?: BuildStateOptions;
  testInfo: TestInfo;
  testContext?: MobileTestContexts;
}) {
  // Resolved BEFORE the Promise.all rather than inside it. As an array element the `await` ran after
  // `openAppMultipleDevices` had already been invoked, so a network-resolution failure (a mismatch, or
  // an unusable devnet) left devices opening with nothing awaiting them — leaked Appium sessions plus
  // an unhandled rejection. Now nothing is opened until the network is known good.
  const network = await resolveNetworkTarget([platform]);

  const [devices, prebuilt] = await Promise.all([
    openAppMultipleDevices(platform, appsToOpen, testInfo, testContext),
    buildStateForTest(stateToBuildKey, groupName, network, stateOptions),
  ]);

  return { devices, prebuilt };
}

/**
 * Alice on one device, with ten seeded contacts already in her conversation list.
 *
 * The mobile counterpart of desktop's `test_Alice_1W_10contacts`, and the seeded replacement for
 * `joinCommunities(N)`: the other ten accounts exist on the swarm so their conversations appear, but
 * only Alice gets a device — which is the saving, since community joins are the slowest setup here.
 *
 * Returns the contact names in seeded order so a spec can pin or reorder them without caring which
 * they are. That order is also the order the conversation list takes with nothing pinned: the seeder
 * staggers each contact's `created` one second apart, descending, and a client derives the
 * conversation's `active_at` from it.
 *
 * `pins` starts the run with those conversations ALREADY pinned in Alice's config, as indices into
 * the state's user list — so `1` is `contactNames[0]`. This bypasses the client, which is the only way
 * to reach more pins than the client itself allows: it silently refuses the sixth, yet config carrying
 * more arrives in production from a linked device or a restore. Their names come back as
 * `pinnedNames` so a spec never has to translate an index into a conversation row.
 */
export async function open_Alice1_with_contacts({
  platform,
  testInfo,
  testContext,
  pins,
}: WithPlatform & {
  testInfo: TestInfo;
  testContext?: MobileTestContext;
  pins?: PinSeedOptions;
}) {
  const stateToBuildKey = '1userWith10Contacts';
  const appsToOpen = 1;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName: undefined,
    stateOptions: pins ? { pins } : undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  // Only Alice's phrase: the contacts never get a device, so linking them would open ten apps to
  // populate one list.
  await linkDevices([result.devices[0]], [result.prebuilt.users[0].seedPhrase]);

  const alice = result.prebuilt.users[0];
  const contactNames = result.prebuilt.users.slice(1).map(u => u.userName);
  // Resolved against the same user list the seeder pinned in, so a name here cannot disagree with what
  // was written. An out-of-range index has already thrown inside the seeder by this point.
  const pinnedNames = (pins ?? []).map(index => result.prebuilt.users[index].userName);

  return {
    device: result.devices[0],
    alice,
    contactNames,
    pinnedNames,
  };
}

export async function open_Alice1_Bob1_friends({
  platform,
  focusFriendsConvo,
  testInfo,
  testContext,
}: WithPlatform &
  WithFocusFriendsConvo & { testInfo: TestInfo; testContext?: MobileTestContexts }) {
  const stateToBuildKey = '2friends';
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName: undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('bob1');
  const seedPhrases = result.prebuilt.users.map(m => m.seedPhrase);
  await linkDevices(result.devices, seedPhrases);

  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  const alice1 = result.devices[0];
  const bob1 = result.devices[1];
  const formattedDevices = {
    alice1,
    bob1,
  };
  const formattedUsers: WithUsers<typeof appsToOpen> = {
    alice,
    bob,
  };
  if (focusFriendsConvo) {
    await focusConvoOnDevices([
      // bob1 opens convo with alice
      { device: bob1, convoName: alice.userName },
      // alice1 opens convo with bob
      { device: alice1, convoName: bob.userName },
    ]);
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers },
  };
}

export async function open_Alice1_Bob1_Charlie1_friends_group({
  platform,
  groupName,
  focusGroupConvo,
  testInfo,
  testContext,
}: WithPlatform &
  WithFocusGroupConvo & {
    groupName: string;
    testInfo: TestInfo;
    testContext?: MobileTestContext;
  }) {
  const stateToBuildKey = '3friendsInGroup';
  const appsToOpen = 3;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('bob1');
  result.devices[2].setDeviceIdentity('charlie1');

  const seedPhrases = result.prebuilt.users.map(m => m.seedPhrase);
  await linkDevices(result.devices, seedPhrases);

  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  const charlie = result.prebuilt.users[2];

  const alice1 = result.devices[0];
  const bob1 = result.devices[1];
  const charlie1 = result.devices[2];

  const formattedGroup = { group: result.prebuilt.group };
  const formattedDevices = {
    alice1,
    bob1,
    charlie1,
  };
  const formattedUsers: WithUsers<typeof appsToOpen> = {
    alice,
    bob,
    charlie,
  };
  if (focusGroupConvo) {
    await focusConvoOnDevices({
      devices: result.devices,
      convoName: result.prebuilt.group.groupName,
    });
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers, ...formattedGroup },
  };
}

export async function open_Alice2_Bob1_Charlie1_friends_group({
  platform,
  groupName,
  focusGroupConvo,
  testInfo,
  testContext,
}: WithPlatform &
  WithFocusGroupConvo & {
    groupName: string;
    testInfo: TestInfo;
    testContext?: MobileTestContext;
  }) {
  const stateToBuildKey = '3friendsInGroup';
  const appsToOpen = 4;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('bob1');
  result.devices[2].setDeviceIdentity('charlie1');
  result.devices[3].setDeviceIdentity('alice2');

  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  const charlie = result.prebuilt.users[2];

  const seedPhrases = [alice.seedPhrase, bob.seedPhrase, charlie.seedPhrase, alice.seedPhrase];
  await linkDevices(result.devices, seedPhrases);

  const [alice1, bob1, charlie1, alice2] = result.devices;

  const formattedGroup = { group: result.prebuilt.group };
  const formattedDevices = {
    alice1,
    bob1,
    charlie1,
    alice2,
  };
  const formattedUsers: WithUsers<3> = {
    alice,
    bob,
    charlie,
  };
  if (focusGroupConvo) {
    await focusConvoOnDevices({
      devices: result.devices,
      convoName: result.prebuilt.group.groupName,
    });
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers, ...formattedGroup },
  };
}

/**
 * Open 4 devices, one for Alice, one for Bob, one for Charlie, and one extra, unlinked.
 * This function is used for testing that we can do a bunch of actions without having a linked device,
 * and then that linking a new device recovers the correct state.
 */
export async function open_Alice1_Bob1_Charlie1_Unknown1({
  platform,
  groupName,
  focusGroupConvo = true,
  testInfo,
  testContext,
}: WithPlatform &
  WithFocusGroupConvo & {
    groupName: string;
    testInfo: TestInfo;
    testContext?: MobileTestContext;
  }) {
  const stateToBuildKey = '3friendsInGroup';
  const appsToOpen = 4;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('bob1');
  result.devices[2].setDeviceIdentity('charlie1');
  result.devices[3].setDeviceIdentity('unknown1'); // this device will be linked later
  const seedPhrases = result.prebuilt.users.map(m => m.seedPhrase);
  await linkDevices(result.devices.slice(0, -1), seedPhrases);

  const formattedGroup = { group: result.prebuilt.group };

  const alice1 = result.devices[0];
  const bob1 = result.devices[1];
  const charlie1 = result.devices[2];

  const formattedDevices = {
    alice1,
    bob1,
    charlie1,
    unknown1: result.devices[3], // not assigned yet
  };
  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  const charlie = result.prebuilt.users[2];
  const formattedUsers: WithUsers<3> = {
    alice,
    bob,
    charlie,
  };
  if (focusGroupConvo) {
    await focusConvoOnDevices({
      // slice off the last device as it will be used later (i.e. we don't want to link yet)
      devices: result.devices.slice(0, -1),
      convoName: result.prebuilt.group.groupName,
    });
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers, ...formattedGroup },
  };
}

/**
 * Alice, seeded, on one device and nothing else.
 *
 * The seeded account carries its own recovery phrase, so anything deriving a key from it — the Pro
 * master key, for one — needs no onboarding to read it back.
 *
 * `open_Alice1_with_contacts` is this plus ten seeded contacts, which are the bulk of that fixture's
 * setup cost.
 */
export async function open_Alice1({
  platform,
  testInfo,
  testContext,
}: WithPlatform & { testInfo: TestInfo; testContext?: MobileTestContext }) {
  const result = await openAppsWithState({
    platform,
    appsToOpen: 1,
    stateToBuildKey: '1user',
    groupName: undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  const alice = result.prebuilt.users[0];
  await linkDevices([result.devices[0]], [alice.seedPhrase]);

  return { device: result.devices[0], alice };
}

export async function open_Alice2({
  platform,
  testInfo,
  testContext,
}: WithPlatform & { testInfo: TestInfo; testContext?: MobileTestContext }) {
  const prebuiltStateKey = '1user';
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: prebuiltStateKey,
    groupName: undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('alice2');
  // we want the first user to have the first 2 devices linked
  const alice = result.prebuilt.users[0];
  const alice1 = result.devices[0];
  const alice2 = result.devices[1];

  const seedPhrases = [alice.seedPhrase, alice.seedPhrase];
  await linkDevices(result.devices, seedPhrases);

  const formattedUsers: WithUsers<1> = {
    alice,
  };

  return {
    devices: {
      // alice has two devices linked right away
      alice1,
      alice2,
    },
    prebuilt: { ...formattedUsers },
  };
}

/**
 * Open 2 devices, one for Alice, one for Bob, but they are not friends
 */
export async function open_Alice1_bob1_notfriends({
  platform,
  testInfo,
  testContext,
}: WithPlatform & { testInfo: TestInfo; testContext?: MobileTestContext }) {
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: '2users',
    groupName: undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('bob1');
  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];

  const alice1 = result.devices[0];
  const bob1 = result.devices[1];

  const seedPhrases = [alice.seedPhrase, bob.seedPhrase];
  await linkDevices(result.devices, seedPhrases);

  const formattedUsers: WithUsers<2> = {
    alice,
    bob,
  };

  return {
    devices: {
      alice1,
      bob1,
    },
    prebuilt: { ...formattedUsers },
  };
}

export async function open_Alice2_Bob1_friends({
  platform,
  focusFriendsConvo,
  testInfo,
  testContext,
}: WithPlatform &
  WithFocusFriendsConvo & { testInfo: TestInfo; testContext?: MobileTestContexts }) {
  const prebuiltStateKey = '2friends';
  const appsToOpen = 3;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: prebuiltStateKey,
    groupName: undefined,
    testInfo,
    testContext,
  });
  result.devices[0].setDeviceIdentity('alice1');
  result.devices[1].setDeviceIdentity('alice2');
  result.devices[2].setDeviceIdentity('bob1');
  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  // we want the first user to have the first 2 devices linked
  const seedPhrases = [alice.seedPhrase, alice.seedPhrase, bob.seedPhrase];
  await linkDevices(result.devices, seedPhrases);

  const alice1 = result.devices[0];
  const alice2 = result.devices[1];
  const bob1 = result.devices[2];

  const formattedUsers: WithUsers<2> = {
    alice,
    bob,
  };

  if (focusFriendsConvo) {
    await focusConvoOnDevices([
      // bob1 opens convo with alice
      { device: bob1, convoName: alice.userName },
      // alice1 opens convo with bob
      { device: alice1, convoName: bob.userName },
    ]);
  }

  return {
    devices: {
      // alice has two devices linked right away
      alice1,
      alice2,
      bob1,
    },
    prebuilt: { ...formattedUsers },
  };
}
