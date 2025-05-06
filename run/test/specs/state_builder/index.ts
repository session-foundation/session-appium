import {
  buildStateForTest,
  type PrebuiltStateKey,
  type StateUser,
  type WithGroupStateKey,
} from '@session-foundation/qa-seeder';
import { openAppMultipleDevices, type SupportedPlatformsType } from '../utils/open_app';
import { restoreAccountNoFallback } from '../utils/restore_account';
import { ConversationItem } from '../locators/home';
import type { DeviceWrapper } from '../../../types/DeviceWrapper';

const networkToTarget = 'mainnet';

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
    | { devices: Array<DeviceWrapper>; convoName: string }
    | Array<{ device: DeviceWrapper; convoName: string }>
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
}: WithPlatform & {
  appsToOpen: A;
  stateToBuildKey: K;
  groupName: K extends WithGroupStateKey ? string : undefined;
}) {
  const [devices, prebuilt] = await Promise.all([
    openAppMultipleDevices(platform, appsToOpen),
    buildStateForTest(stateToBuildKey, groupName, networkToTarget),
  ]);

  return { devices, prebuilt };
}

export async function open_Alice1_Bob1_friends({
  platform,
  focusFriendsConvo,
}: WithPlatform & WithFocusFriendsConvo) {
  const stateToBuildKey = '2friends';
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName: undefined,
  });
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
}: WithPlatform &
  WithFocusGroupConvo & {
    groupName: string;
  }) {
  const stateToBuildKey = '3friendsInGroup';
  const appsToOpen = 3;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName,
  });
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

/**
 * Open 4 devices, one for Alice, one for Bob, one for Charlie, and one extra, unlinked.
 * This function is used for testing that we can do a bunch of actions without having a linked device,
 * and then that linking a new device recovers the correct state.
 */
export async function open_Alice1_Bob1_Charlie1_Unknown1({
  platform,
  groupName,
  focusGroupConvo = true,
}: WithPlatform &
  WithFocusGroupConvo & {
    groupName: string;
  }) {
  const stateToBuildKey = '3friendsInGroup';
  const appsToOpen = 4;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey,
    groupName,
  });

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

export async function open_Alice2({ platform }: WithPlatform) {
  const prebuiltStateKey = '1user';
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: prebuiltStateKey,
    groupName: undefined,
  });
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
export async function open_Alice1_bob1_notfriends({ platform }: WithPlatform) {
  const appsToOpen = 2;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: '2users',
    groupName: undefined,
  });
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
}: WithPlatform & WithFocusFriendsConvo) {
  const prebuiltStateKey = '2friends';
  const appsToOpen = 3;
  const result = await openAppsWithState({
    platform,
    appsToOpen,
    stateToBuildKey: prebuiltStateKey,
    groupName: undefined,
  });
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
