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

type WithDevice1 = { device1: DeviceWrapper };
type WithDevice2 = { device2: DeviceWrapper };
type WithDevice3 = { device3: DeviceWrapper };
type WithDevice4 = { device4: DeviceWrapper };

type WithUserA = { userA: StateUser };
type WithUserB = { userB: StateUser };
type WithUserC = { userC: StateUser };
type WithUserD = { userD: StateUser };

type WithFocusFriendsConvo = { focusFriendsConvo: boolean };
type WithFocusGroupConvo = { focusGroupConvo: boolean };
type WithPlatform = { platform: SupportedPlatformsType };

export type AppCountPerTest = 1 | 2 | 3 | 4;

type WithDevices<C extends AppCountPerTest> = C extends 4
  ? WithDevice1 & WithDevice2 & WithDevice3 & WithDevice4
  : C extends 3
    ? WithDevice1 & WithDevice2 & WithDevice3
    : C extends 2
      ? WithDevice1 & WithDevice2
      : C extends 1
        ? WithDevice1
        : never;

type WithUsers<C extends AppCountPerTest> = C extends 4
  ? WithUserA & WithUserB & WithUserC & WithUserD
  : C extends 3
    ? WithUserA & WithUserB & WithUserC
    : C extends 2
      ? WithUserA & WithUserB
      : C extends 1
        ? WithUserA
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

export async function open2AppsWithFriendsState({
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

  const formattedDevices: WithDevices<typeof appsToOpen> = {
    device1: alice1,
    device2: bob1,
  };
  const formattedUsers: WithUsers<typeof appsToOpen> = {
    userA: alice,
    userB: bob,
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

export async function open3AppsWith3FriendsAnd1GroupState({
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
  const formattedDevices: WithDevices<typeof appsToOpen> = {
    device1: alice1,
    device2: bob1,
    device3: charlie1,
  };
  const formattedUsers: WithUsers<typeof appsToOpen> = {
    userA: alice,
    userB: bob,
    userC: charlie,
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

export async function open4AppsWith3Friends1GroupState({
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
  await linkDevices(result.devices, seedPhrases);

  const formattedGroup = { group: result.prebuilt.group };

  const alice1 = result.devices[0];
  const bob1 = result.devices[1];
  const charlie1 = result.devices[2];

  const formattedDevices: WithDevices<typeof appsToOpen> = {
    device1: alice1,
    device2: bob1,
    device3: charlie1,
    device4: result.devices[3], // not assigned yet
  };
  const alice = result.prebuilt.users[0];
  const bob = result.prebuilt.users[1];
  const charlie = result.prebuilt.users[2];
  const formattedUsers: WithUsers<3> = {
    userA: alice,
    userB: bob,
    userC: charlie,
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

export async function open2AppsLinkedUser({ platform }: WithPlatform) {
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
    userA: alice,
  };

  return {
    devices: {
      // alice has two devices linked right away
      device1: alice1,
      device2: alice2,
    },
    prebuilt: { ...formattedUsers },
  };
}

export async function open3Apps2Friends2LinkedFirstUser({
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
    userA: alice,
    userB: bob,
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
      device1: alice1,
      device2: alice2,
      device3: bob1,
    },
    prebuilt: { ...formattedUsers },
  };
}
