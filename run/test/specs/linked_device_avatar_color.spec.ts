import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { isSameColor } from './utils/check_colour';
import { UserSettings } from './locators/settings';
import { open2AppsLinkedUser } from './state_builder';

bothPlatformsIt({
  title: 'Avatar color linked device',
  risk: 'medium',
  testCb: avatarColorLinkedDevice,
  countOfDevicesNeeded: 2,
});
async function avatarColorLinkedDevice(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsLinkedUser({ platform });
  
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
