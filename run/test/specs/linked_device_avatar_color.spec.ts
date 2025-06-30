import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { UserSettings } from './locators/settings';
import { open_Alice2 } from './state_builder';
import { isSameColor } from './utils/check_colour';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Avatar color linked device',
  risk: 'medium',
  testCb: avatarColorLinkedDevice,
  countOfDevicesNeeded: 2,
});
async function avatarColorLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
    prebuilt: { alice },
  } = await open_Alice2({ platform, testInfo });

  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const alice1PixelColor = await alice1.getElementPixelColor(new UserSettings(alice1));
  // Get Alice's avatar color on the linked device (Home Screen avatar) and turn it into a hex value
  const alice2PixelColor = await alice2.getElementPixelColor(new UserSettings(alice2));
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(alice1PixelColor, alice2PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${alice.userName} does not match across devices. The colors are ${alice1PixelColor} and ${alice2PixelColor}`
    );
  }
  await closeApp(alice1, alice2);
}
