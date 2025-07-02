import type { TestInfo } from '@playwright/test';

import { bothPlatformsItSeparate } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { ConversationItem } from './locators/home';
import { UserSettings } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { isSameColor } from './utils/check_colour';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsItSeparate({
  title: 'Avatar color',
  risk: 'medium',
  countOfDevicesNeeded: 2,
  ios: {
    testCb: avatarColor,
    shouldSkip: false,
  },
  android: {
    testCb: avatarColor,
    shouldSkip: true, // something is going on on Android, test is picking up wildly different pixel colors
  },
});

async function avatarColor(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false,
    testInfo,
  });

  // Get Alice's avatar color on device 1 (Settings screen avatar) and turn it into a hex value
  await alice1.clickOnElementAll(new UserSettings(alice1));
  const alice1PixelColor = await alice1.getElementPixelColor(new UserSettings(alice1));
  alice1.log(alice1PixelColor);
  // Get Alice's avatar color on device 2 and turn it into a hex value
  // Open the conversation with Alice on Bob's device
  await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
  const bob1PixelColor = await bob1.getElementPixelColor(new ConversationSettings(bob1));
  bob1.log(bob1PixelColor);
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(alice1PixelColor, bob1PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${alice.userName} does not match across devices. The colors are ${alice1PixelColor} and ${bob1PixelColor}`
    );
  }
  await closeApp(alice1, bob1);
}
