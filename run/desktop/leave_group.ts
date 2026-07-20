// @ported-from tests/automation/utilities/leave_group.ts
// @port-kind   verbatim
import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { Conversation, Global, HomeScreen } from './locators';
import { Group } from './types';
import { clickOn, clickOnMatchingText, clickOnWithText, hasElementBeenDeleted } from './utils';

export const leaveGroup = async (window: Page, group: Group) => {
  // go to three dots menu
  await clickOn(window, Conversation.conversationSettingsIcon);
  // Select Leave Group
  await clickOnMatchingText(window, tStripped('groupLeave'));
  // Confirm leave group
  await clickOnWithText(window, Global.confirmButton, tStripped('leave'));
  // check config message
  await hasElementBeenDeleted(window, HomeScreen.conversationItemName, {
    maxWait: 5_000,
    text: group.userName,
  });
};
