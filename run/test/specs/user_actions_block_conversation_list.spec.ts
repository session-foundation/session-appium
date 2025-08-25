import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockedContactsSettings } from './locators';
import { LongPressBlockOption } from './locators/home';
import { ConversationsMenuItem, UserSettings } from './locators/settings';
import { open_Alice1_Bob1_friends } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

// Block option no longer available on iOS in conversation list
androidIt({
  title: 'Block user in conversation list',
  risk: 'high',
  testCb: blockUserInConversationList,
  countOfDevicesNeeded: 2,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Block/Unblock',
  },
  allureDescription: 'Verifies that a user can be blocked from the home screen long press menu',
});

async function blockUserInConversationList(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // Navigate back to conversation list
  await alice1.navigateBack();
  await alice1.longPressConversation(bob.userName);
  await alice1.clickOnElementAll(new LongPressBlockOption(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: USERNAME.BOB }).toString()
  );
  await alice1.clickOnByAccessibilityID('Block');
  // Once you block the conversation disappears from the home screen
  await alice1.verifyElementNotPresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: bob.userName,
    maxWait: 5000,
  });
  await alice1.clickOnElementAll(new UserSettings(alice1));
  // 'Conversations' might be hidden beyond the Settings view, gotta scroll down to find it
  await alice1.scrollDown();
  await alice1.clickOnElementAll(new ConversationsMenuItem(alice1));
  await alice1.clickOnElementAll(new BlockedContactsSettings(alice1));
  await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: bob.userName,
  });
  await closeApp(alice1, bob1);
}
