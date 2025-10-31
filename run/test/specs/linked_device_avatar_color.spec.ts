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
  allureSuites: {
    parent: 'Visual Checks',
    suite: 'Onboarding',
  },
  allureDescription: `Verifies that a user's avatar color is consistent across linked devices.`,
});
async function avatarColorLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform, testInfo });

  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const alice1PixelColor = await alice1.getElementPixelColor(new UserSettings(alice1));
  // Get Alice's avatar color on the linked device (Home Screen avatar) and turn it into a hex value
  const alice2PixelColor = await alice2.getElementPixelColor(new UserSettings(alice2));
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(alice1PixelColor, alice2PixelColor);
  if (!colorMatch) {
    console.log(`Device 1 pixel color: ${alice1PixelColor}`);
    console.log(`Device 2 pixel color: ${alice2PixelColor}`);
    throw new Error(`The user's placeholder avatar color does not match across linked devices.`);
  }
  await closeApp(alice1, alice2);
}
