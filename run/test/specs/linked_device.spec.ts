import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UserSettings } from './locators/settings';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Link device', 'high', linkDevice);

async function linkDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  // link device
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE, platform);
  // Check that 'Youre almost finished' reminder doesn't pop up on device2
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
  });
  // Verify username and session ID match
  await device2.clickOnElementAll(new UserSettings(device2));
  // Check username
  await device2.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Username',
    text: userA.userName,
  });

  await device2.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Display name',
    text: userA.userName,
  });

  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Account ID',
    text: userA.accountID,
  });

  await closeApp(device1, device2);
}
