import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { compareColors, parseDataImage } from './utils/check_colour';
import { UserSettings } from './locators/settings';

bothPlatformsIt('Avatar color linked device', 'medium', avatarColorLinkedDevice);

async function avatarColorLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const userA = await linkedDevice(device1, device2, USERNAME.ALICE, platform);
  // Get Alice's avatar color on device 1 and turn it into a hex value
  const device1Avatar = await device1.waitForTextElementToBePresent(new UserSettings(device1));
  const device1Base64 = await device1.getElementScreenshot(device1Avatar.ELEMENT);
  const device1PixelColor = await parseDataImage(device1Base64);
  // Get Alice's avatar color on the linked device and turn it into a hex value
  const device2Avatar = await device2.waitForTextElementToBePresent(new UserSettings(device2));
  const device2Base64 = await device2.getElementScreenshot(device2Avatar.ELEMENT);
  const device2PixelColor = await parseDataImage(device2Base64);
  // Color comparison of devices 1 and 2
  const colorMatch = compareColors(device1PixelColor, device2PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${userA.userName} does not match across devices. The colors are ${device1PixelColor} and ${device2PixelColor}`
    );
  }
  await closeApp(device1, device2);
}
