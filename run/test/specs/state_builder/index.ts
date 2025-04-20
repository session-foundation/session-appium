import {
  buildStateForTest,
  type PrebuiltState,
  type PrebuiltStateKey,
} from '@session-foundation/qa-seeder';
import { openAppMultipleDevices, type SupportedPlatformsType } from '../utils/open_app';
import { restoreAccountNoFallback } from '../utils/restore_account';
import type { DeviceWrapper } from '../../../types/DeviceWrapper';
import type { Tuple } from '../../../types/tuple';

export async function openAppsWithState<C extends 1 | 2 | 3 | 4, K extends PrebuiltStateKey>(
  platform: SupportedPlatformsType,
  countToOpen: C,
  stateToBuildKey: K,
  testTitle: string
) {
  const [devices, prebuilt] = await Promise.all([
    openAppMultipleDevices(platform, countToOpen),
    buildStateForTest(stateToBuildKey, testTitle, 'mainnet'),
  ]);

  await Promise.all(
    devices.map((d, index) => {
      const seedPhrase = prebuilt.users[index].seedPhrase as string;
      if (!seedPhrase) {
        throw new Error(`No seed phrase found for user ${index}`);
      }
      return restoreAccountNoFallback(d, seedPhrase);
    })
  );
  return { devices: devices as Tuple<DeviceWrapper, C>, prebuilt: prebuilt as PrebuiltState[K] };
}
