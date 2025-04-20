import { englishStripped } from '../../localizer/Localizer';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockedContactsSettings, BlockUser, BlockUserConfirmationModal } from './locators';
import { UserSettings } from './locators/settings';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

// Block option not available on iOS in conversation list
androidIt('Block user in conversation list', 'high', blockUserInConversationList);
// No longer available on iOS

async function blockUserInConversationList(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  // Navigate back to conversation list
  await device1.navigateBack();
  // on ios swipe left on conversation
  await device1.longPressConversation(userB.userName);
  await device1.clickOnElementAll(new BlockUser(device1));
  await device1.checkModalStrings(
    englishStripped('block').toString(),
    englishStripped('blockDescription').withArgs({ name: USERNAME.BOB }).toString(),
    true
  );
  await device1.clickOnElementAll(new BlockUserConfirmationModal(device1));
  await device1.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userB.userName,
  });
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });
  await device1.navigateBack();
  await device1.clickOnElementAll(new UserSettings(device1));
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' });
  await device1.clickOnElementAll(new BlockedContactsSettings(device1));
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await closeApp(device1, device2);
}
