import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { BlockedContactsSettings, BlockUser, BlockUserConfirmationModal } from './locators';
import { BlockedBanner, ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import { ConversationItem } from './locators/home';
import { ConversationsMenuItem, UserSettings } from './locators/settings';
import { open_Alice2_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Block user linked device',
  risk: 'high',
  testCb: blockUserInConversationOptions,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Block/Unblock',
  },
  allureDescription: 'Verifies that a blocked user syncs to a linked device',
});

async function blockUserInConversationOptions(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });
  // Block contact
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Select Block option
  await sleepFor(500);
  await alice1.onIOS().scrollDown(); // Blind scroll because Block option is obscured by system UI on iOS
  await alice1.clickOnElementAll(new BlockUser(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: bob.userName }).toString()
  );
  // Confirm block option
  await alice1.clickOnElementAll(new BlockUserConfirmationModal(alice1));
  // On ios there is an alert that confirms that the user has been blocked
  await sleepFor(1000);
  // On ios, you need to navigate back to conversation screen to confirm block
  await alice1.navigateBack();
  // Look for alert at top of screen (Bob is blocked. Unblock them?)
  // Check device 1 for blocked status
  const blockedStatus = await alice1.waitForTextElementToBePresent(new BlockedBanner(alice1));
  if (blockedStatus) {
    // Check linked device for blocked status (if shown on alice1)
    await alice2.onAndroid().clickOnElementAll(new ConversationItem(alice2, bob.userName));
    await alice2.onAndroid().waitForTextElementToBePresent(new BlockedBanner(alice2));
    alice2.info(`${bob.userName}` + ' has been blocked');
  } else {
    alice2.info('Blocked banner not found');
  }
  // Check settings for blocked user
  await Promise.all([alice1.navigateBack(), alice2.onAndroid().navigateBack()]);
  await Promise.all([
    alice1.clickOnElementAll(new UserSettings(alice1)),
    alice2.clickOnElementAll(new UserSettings(alice2)),
  ]);
  // 'Conversations' might be hidden beyond the Settings view, gotta scroll down to find it
  await Promise.all([alice1.scrollDown(), alice2.scrollDown()]);
  await Promise.all([
    alice1.clickOnElementAll(new ConversationsMenuItem(alice1)),
    alice2.clickOnElementAll(new ConversationsMenuItem(alice2)),
  ]);
  await Promise.all([
    alice1.clickOnElementAll(new BlockedContactsSettings(alice1)),
    alice2.clickOnElementAll(new BlockedContactsSettings(alice2)),
  ]);
  await Promise.all([
    alice1.waitForTextElementToBePresent(new Contact(alice1, bob.userName)),
    alice2.waitForTextElementToBePresent(new Contact(alice2, bob.userName)),
  ]);
  // Close app
  await closeApp(alice1, bob1, alice2);
}
