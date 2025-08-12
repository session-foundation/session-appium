import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import {
  BlockedContactsSettings,
  BlockUser,
  BlockUserConfirmationModal,
  ExitUserProfile,
} from './locators';
import { BlockedBanner, ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import { ConversationsMenuItem, UserSettings } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Block user in conversation settings',
  risk: 'high',
  testCb: blockUserInConversationSettings,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Block/Unblock',
  },
  allureDescription: 'Verifies that a user can be blocked from the conversation settings',
});

async function blockUserInConversationSettings(
  platform: SupportedPlatformsType,
  testInfo: TestInfo
) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  const blockedMessage = 'Blocked message';

  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Select Block option
  await sleepFor(500);
  await alice1.clickOnElementAll(new BlockUser(alice1));
  // Check modal strings
  await alice1.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: bob.userName }).toString()
  );
  // Confirm block option
  await alice1.clickOnElementAll(new BlockUserConfirmationModal(alice1));
  await sleepFor(1000);
  // Navigate back to conversation screen to confirm block
  await alice1.navigateBack();
  // Look for alert at top of screen (Bob is blocked. Unblock them?)
  // Check device 1 for blocked status
  const blockedStatus = await alice1.waitForTextElementToBePresent({
    ...new BlockedBanner(alice1).build(),
    maxWait: 5000,
  });
  if (blockedStatus) {
    console.info(`${bob.userName} has been blocked`);
  } else {
    console.info('Blocked banner not found');
  }
  // Check settings for blocked user
  await alice1.navigateBack();
  await alice1.clickOnElementAll(new UserSettings(alice1));
  // 'Conversations' might be hidden beyond the Settings view, gotta scroll down to find it
  await alice1.scrollDown();
  await alice1.clickOnElementAll(new ConversationsMenuItem(alice1));
  await alice1.clickOnElementAll(new BlockedContactsSettings(alice1));
  // Accessibility ID for Blocked Contact not present on iOS
  await alice1.waitForTextElementToBePresent(new Contact(alice1, bob.userName));
  await alice1.navigateBack(false);
  await alice1.navigateBack(false);
  await alice1.clickOnElementAll(new ExitUserProfile(alice1));
  // Send message from Blocked User
  await bob1.sendMessage(blockedMessage);
  await alice1.verifyElementNotPresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
    maxWait: 5000,
  });
  // Close app
  await closeApp(alice1, bob1);
}
