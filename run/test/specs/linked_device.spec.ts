import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { UsernameSettings } from './locators';
import { UserSettings } from './locators/settings';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Link device', 'high', linkDevice);

async function linkDevice(platform: SupportedPlatformsType) {
  // Open server and two devices
  const { device1, device2 } = await openAppTwoDevices(platform);
  // link device
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
  // Check that 'Youre almost finished' reminder doesn't pop up on device2
  await device2.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Recovery phrase reminder',
    maxWait: 1000,
  });
  // Verify username and session ID match
  await device2.clickOnElementAll(new UserSettings(device2));
  // Check username
  await device2.waitForTextElementToBePresent({
    ...new UsernameSettings(device2).build(),
    text: USERNAME.ALICE,
  });
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Account ID',
    text: userA.accountID,
  });

  await closeApp(device1, device2);
}
