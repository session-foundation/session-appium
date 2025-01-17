import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { isSameColor } from './utils/check_colour';
import { UserSettings } from './locators/settings';
import { ConversationItem } from './locators/home';
import { ConversationAvatar, ConversationSettings } from './locators/conversation';

bothPlatformsIt('Avatar color', 'medium', avatarColor);

async function avatarColor(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await Promise.all([device1.navigateBack(), device2.navigateBack()]);
  // Get Alice's avatar color on device 1 (Home Screen avatar) and turn it into a hex value
  const device1PixelColor = await device1.getElementPixelColor(new UserSettings(device1));
  // Get Alice's avatar color on device 2 and turn it into a hex value
  await device2.clickOnElementAll(new ConversationItem(device2));
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
