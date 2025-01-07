import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';
import { compareColors, parseDataImage } from './utils/check_colour';
import { UserSettings } from './locators/settings';
import { ConversationItem } from './locators/home';
import { ConversationAvatar, ConversationSettings } from './locators/conversation';

bothPlatformsIt('Avatar color', 'medium', avatarColor);

async function avatarColor(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  await newContact(platform, device1, userA, device2, userB);
  await device1.navigateBack();
  await device2.navigateBack();
  // Get Alice's avatar color on device 1 and turn it into a hex value
  const device1Avatar = await device1.waitForTextElementToBePresent(new UserSettings(device1));
  const device1Base64 = await device1.getElementScreenshot(device1Avatar.ELEMENT);
  const device1PixelColor = await parseDataImage(device1Base64);
  // Get Alice's avatar color on device 2 and turn it into a hex value
  await device2.clickOnElementAll(new ConversationItem(device2));
  let device2Avatar;
  if (platform === 'ios') {
    device2Avatar = await device2.waitForTextElementToBePresent(new ConversationSettings(device2));
  } else {
    device2Avatar = await device2.waitForTextElementToBePresent(new ConversationAvatar(device2));
  }
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
