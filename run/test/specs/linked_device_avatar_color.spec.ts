import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { isSameColor } from './utils/check_colour';
import { UserSettings } from './locators/settings';

bothPlatformsIt({
  title: 'Avatar color linked device',
  risk: 'medium',
  testCb: avatarColorLinkedDevice,
  countOfDevicesNeeded: 2,
});
async function avatarColorLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE);
  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const device1PixelColor = await device1.getElementPixelColor(new UserSettings(device1));
  // Get Alice's avatar color on the linked device (Home Screen avatar) and turn it into a hex value
  const device2PixelColor = await device2.getElementPixelColor(new UserSettings(device2));
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(device1PixelColor, device2PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${userA.userName} does not match across devices. The colors are ${device1PixelColor} and ${device2PixelColor}`
    );
  }
  await closeApp(device1, device2);
}
