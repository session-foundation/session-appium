import { USERNAME } from '@session-foundation/qa-seeder';
import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt({
  title: 'Link device',
  risk: 'high',
  testCb: linkDevice,
  countOfDevicesNeeded: 2,
});

async function linkDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const { device1: alice1, device2: alice2 } = await openAppTwoDevices(platform);
  // link device
  const alice = await linkedDevice(alice1, alice2, USERNAME.ALICE);
  // Check that 'Youre almost finished' reminder doesn't pop up on alice2
  await alice2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
    maxWait: 1000,
  });
  // Verify username and session ID match
  await alice2.clickOnElementAll(new UserSettings(alice2));
  // Check username
  await alice2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: alice.userName,
  });

  await alice2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: alice.userName,
  });

  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Account ID',
    text: alice.accountID,
  });

  await closeApp(alice1, alice2);
}
