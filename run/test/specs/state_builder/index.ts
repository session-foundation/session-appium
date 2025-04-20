import {
  buildStateForTest,
  type PrebuiltStateKey,
  type StateUser,
} from '@session-foundation/qa-seeder';
import { openAppMultipleDevices, type SupportedPlatformsType } from '../utils/open_app';
import { restoreAccountNoFallback } from '../utils/restore_account';
import { ConversationItem } from '../locators/home';
import type { DeviceWrapper } from '../../../types/DeviceWrapper';
import type { Tuple } from '../../../types/tuple';

type WithDevice1 = { device1: DeviceWrapper };
type WithDevice2 = { device2: DeviceWrapper };
type WithDevice3 = { device3: DeviceWrapper };
type WithDevice4 = { device4: DeviceWrapper };

type WithUserA = { userA: StateUser };
type WithUserB = { userB: StateUser };

type WithDevices<T extends Tuple<DeviceWrapper, 1 | 2 | 3 | 4>> = T extends [
  infer _A,
  infer _B,
  infer _C,
  infer _D,
]
  ? WithDevice1 & WithDevice2 & WithDevice3 & WithDevice4
  : T extends [infer _A, infer _B, infer _C]
    ? WithDevice1 & WithDevice2 & WithDevice3
    : T extends [infer _A, infer _B]
      ? WithDevice1 & WithDevice2
      : T extends [infer _A]
        ? WithDevice1
        : never;

async function openAppsWithState<C extends 1 | 2 | 3 | 4, K extends PrebuiltStateKey>({
  countToOpen,
  platform,
  testTitle,
  stateToBuildKey,
}: {
  platform: SupportedPlatformsType;
  countToOpen: C;
  stateToBuildKey: K;
  testTitle: string;
}) {
  const [devices, prebuilt] = await Promise.all([
    openAppMultipleDevices(platform, countToOpen),
    buildStateForTest(stateToBuildKey, testTitle, 'mainnet'),
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
  testTitle,
  focusFriendsConvo = true,
}: {
  platform: SupportedPlatformsType;
  testTitle: string;
  focusFriendsConvo?: boolean;
}) {
  const stateToBuildKey = '2friends';
  const countToOpen = 2;
  const result = await openAppsWithState({
    platform,
    countToOpen,
    stateToBuildKey,
    testTitle,
  });
  const formattedDevices: WithDevices<Tuple<DeviceWrapper, typeof countToOpen>> = {
    device1: result.devices[0],
    device2: result.devices[1],
  };
  const formattedUsers: WithUserA & WithUserB = {
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
    prebuilt: formattedUsers,
  };
}
