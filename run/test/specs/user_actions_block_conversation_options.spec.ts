import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import {
  BlockedContactsSettings,
  BlockUser,
  BlockUserConfirmationModal,
  ExitUserProfile,
} from './locators';
import { ConversationSettings } from './locators/conversation';
import { UserSettings } from './locators/settings';
import { open2AppsWithFriendsState } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Block user in conversation options', 'high', blockUserInConversationOptions);

async function blockUserInConversationOptions(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userB },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const blockedMessage = 'Blocked message';

  await device1.clickOnElementAll(new ConversationSettings(device1));
  // Select Block option
  await sleepFor(500);
  await device1.clickOnElementAll(new BlockUser(device1));
  // Check modal strings
  await device1.checkModalStrings(
    englishStripped('block').toString(),
    englishStripped('blockDescription').withArgs({ name: userB.userName }).toString(),
    true
  );
  // Confirm block option
  await device1.clickOnElementAll(new BlockUserConfirmationModal(device1));
  await sleepFor(1000);
  // On ios, you need to navigate back to conversation screen to confirm block
  await device1.onIOS().navigateBack();
  // Look for alert at top of screen (Bob is blocked. Unblock them?)
  // Check device 1 for blocked status
  const blockedStatus = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });
  if (blockedStatus) {
    console.info(`${userB.userName} has been blocked`);
  } else {
    console.info('Blocked banner not found');
  }
  // Check settings for blocked user
  await device1.navigateBack();
  await device1.clickOnElementAll(new UserSettings(device1));
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' });
  await device1.clickOnElementAll(new BlockedContactsSettings(device1));
  // Accessibility ID for Blocked Contact not present on iOS
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });
  await device1.navigateBack();
  await device1.navigateBack();
  await device1.clickOnElementAll(new ExitUserProfile(device1));
  // Send message from Blocked User
  await device2.sendMessage(blockedMessage);
  await device1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
    maxWait: 5000,
  });
  // Close app
  await closeApp(device1, device2);
}
