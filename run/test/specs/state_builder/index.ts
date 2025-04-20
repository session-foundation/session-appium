import {
  buildStateForTest,
  type PrebuiltStateKey,
  type StateUser,
} from '@session-foundation/qa-seeder';
import { openAppMultipleDevices, type SupportedPlatformsType } from '../utils/open_app';
import { restoreAccountNoFallback } from '../utils/restore_account';
import { ConversationItem } from '../locators/home';
import type { DeviceWrapper } from '../../../types/DeviceWrapper';

type WithDevice1 = { device1: DeviceWrapper };
type WithDevice2 = { device2: DeviceWrapper };
type WithDevice3 = { device3: DeviceWrapper };
type WithDevice4 = { device4: DeviceWrapper };

type WithUserA = { userA: StateUser };
type WithUserB = { userB: StateUser };
type WithUserC = { userC: StateUser };
type WithUserD = { userD: StateUser };

type WithDevices<C extends number> = C extends 4
  ? WithDevice1 & WithDevice2 & WithDevice3 & WithDevice4
  : C extends 3
    ? WithDevice1 & WithDevice2 & WithDevice3
    : C extends 2
      ? WithDevice1 & WithDevice2
      : C extends 1
        ? WithDevice1
        : never;

type WithUsers<C extends number> = C extends 4
  ? WithUserA & WithUserB & WithUserC & WithUserD
  : C extends 3
    ? WithUserA & WithUserB & WithUserC
    : C extends 2
      ? WithUserA & WithUserB
      : C extends 1
        ? WithUserA
        : never;

async function openAppsWithState<C extends 1 | 2 | 3 | 4, K extends PrebuiltStateKey>({
  countToOpen,
  platform,
  groupName,
  stateToBuildKey,
}: {
  platform: SupportedPlatformsType;
  countToOpen: C;
  stateToBuildKey: K;
  groupName: K extends '3friendsInGroup' | '2friendsInGroup' ? string : undefined;
}) {
  const [devices, prebuilt] = await Promise.all([
    openAppMultipleDevices(platform, countToOpen),
    buildStateForTest(stateToBuildKey, groupName, 'mainnet'),
  ]);
  await Promise.all(
    devices.map((d, index) => {
      const seedPhrase = prebuilt.users[index].seedPhrase as unknown as string;
      if (!seedPhrase) {
        throw new Error(`No seed phrase found for user ${index}`);
      }
      return restoreAccountNoFallback(d, seedPhrase);
    })
  );

  return { devices, prebuilt };
}

export async function open2AppsWithFriendsState({
  platform,
  focusFriendsConvo = true,
}: {
  platform: SupportedPlatformsType;
  focusFriendsConvo?: boolean;
}) {
  const stateToBuildKey = '2friends';
  const countToOpen = 2;
  const result = await openAppsWithState({
    platform,
    countToOpen,
    stateToBuildKey,
    groupName: undefined,
  });
  const formattedDevices: WithDevices<typeof countToOpen> = {
    device1: result.devices[0],
    device2: result.devices[1],
  };
  const formattedUsers: WithUsers<typeof countToOpen> = {
    userA: result.prebuilt.users[0],
    userB: result.prebuilt.users[1],
  };
  if (focusFriendsConvo) {
    await Promise.all([
      result.devices[1].clickOnElementAll(
        new ConversationItem(result.devices[1], result.prebuilt.users[0].userName) // device[1] opens convo with user[0]
      ),
      result.devices[0].clickOnElementAll(
        new ConversationItem(result.devices[0], result.prebuilt.users[1].userName) // device[0] opens convo with user[1]
      ),
    ]);
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers },
  };
}

export async function open3AppsWithFriendsAnd1GroupState({
  platform,
  groupName,
  focusGroupConvo = true,
}: {
  platform: SupportedPlatformsType;
  groupName: string;
  focusGroupConvo?: boolean;
}) {
  const stateToBuildKey = '3friendsInGroup';
  const countToOpen = 3;
  const result = await openAppsWithState({
    platform,
    countToOpen,
    stateToBuildKey,
    groupName,
  });
  const formattedGroup = { group: result.prebuilt.group };
  const formattedDevices: WithDevices<typeof countToOpen> = {
    device1: result.devices[0],
    device2: result.devices[1],
    device3: result.devices[2],
  };
  const formattedUsers: WithUsers<typeof countToOpen> = {
    userA: result.prebuilt.users[0],
    userB: result.prebuilt.users[1],
    userC: result.prebuilt.users[2],
  };
  if (focusGroupConvo) {
    await Promise.all([
      result.devices.map(async d =>
        d.clickOnElementAll(
          new ConversationItem(result.devices[1], result.prebuilt.group.groupName)
        )
      ),
    ]);
  }

  return {
    devices: formattedDevices,
    prebuilt: { ...formattedUsers, ...formattedGroup },
  };
}
