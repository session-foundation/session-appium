import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt('Create group', 'high', groupCreation);

async function groupCreation(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userOne, userTwo, userThree] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);

  await createGroup(
    platform,
    device1,
    userOne,
    device2,
    userTwo,
    device3,
    userThree,
    testGroupName,
    true
  );
  await closeApp(device1, device2, device3);
}
