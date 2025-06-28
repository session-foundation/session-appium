import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Create group',
  risk: 'high',
  testCb: groupCreation,
  countOfDevicesNeeded: 3,
});

async function groupCreation(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Test group';
  const { device1, device2, device3 } = await openAppThreeDevices(platform, testInfo);
  // Create users A, B and C
  const [alice, bob, charlie] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B and User C
  // Note: we keep createGroup here because we want it to **indeed** use the UI to create the group
  await createGroup(platform, device1, alice, device2, bob, device3, charlie, testGroupName, true);
  await closeApp(device1, device2, device3);
}
