import { bothPlatformsIt } from '../../types/sessionIt';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { isSameColor } from './utils/check_colour';
import { UserSettings } from './locators/settings';
import { ConversationAvatar, ConversationSettings } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';

bothPlatformsIt('Avatar color', 'medium', avatarColor);

async function avatarColor(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
  });

  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const device1PixelColor = await device1.getElementPixelColor(new UserSettings(device1));
  // Get Alice's avatar color on device 2 and turn it into a hex value
  let device2PixelColor;
  // The conversation screen looks slightly different per platform so we're grabbing the avatar from different locators
  // On iOS the avatar doubles as the Conversation Settings button on the right
  // On Android, the avatar is a separate, non-interactable element on the left (and the settings has the 3-dot icon)
  if (platform === 'ios') {
    device2PixelColor = await device2.getElementPixelColor(new ConversationSettings(device2));
  } else {
    device2PixelColor = await device2.getElementPixelColor(new ConversationAvatar(device2));
  }
  // Color matching devices 1 and 2
  const colorMatch = isSameColor(device1PixelColor, device2PixelColor);
  if (!colorMatch) {
    throw new Error(
      `The avatar color of ${userA.userName} does not match across devices. The colors are ${device1PixelColor} and ${device2PixelColor}`
    );
  }
  await closeApp(device1, device2);
}
