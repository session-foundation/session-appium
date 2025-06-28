import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { isSameColor } from './utils/check_colour';
import { UserSettings } from './locators/settings';
import { ConversationAvatar, ConversationSettings } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { ConversationItem } from './locators/home';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Avatar color',
  risk: 'medium',
  testCb: avatarColor,
  countOfDevicesNeeded: 2,
});

async function avatarColor(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: false, testInfo });

  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const alice1PixelColor = await alice1.getElementPixelColor(new UserSettings(alice1));
  // Get Alice's avatar color on device 2 and turn it into a hex value
  let bob1PixelColor;
  // Open the conversation with Alice on Bob's device
  await bob1.clickOnElementAll(new ConversationItem(bob1, alice.userName));
  // The conversation screen looks slightly different per platform so we're grabbing the avatar from different locators
  // On iOS the avatar doubles as the Conversation Settings button on the right
  // On Android, the avatar is a separate, non-interactable element on the left (and the settings has the 3-dot icon)
  if (platform === 'ios') {
    bob1PixelColor = await bob1.getElementPixelColor(new ConversationSettings(bob1));
  } else {
    bob1PixelColor = await bob1.getElementPixelColor(new ConversationAvatar(bob1));
  }
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(alice1PixelColor, bob1PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${alice.userName} does not match across devices. The colors are ${alice1PixelColor} and ${bob1PixelColor}`
    );
  }
  await closeApp(alice1, bob1);
}
