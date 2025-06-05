import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { closeApp, openAppOnPlatformSingleDevice, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Create user',
  risk: 'debug', // TODO adjust this to high
  testCb: createUser,
  countOfDevicesNeeded: 1,
});

async function createUser(platform: SupportedPlatformsType) {
  const { device } = await openAppOnPlatformSingleDevice(platform);
  await newUser(device, USERNAME.ALICE);
  // Should verify session ID and recovery phrase are what was originally created
  await closeApp(device);
}
