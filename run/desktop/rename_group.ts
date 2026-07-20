// @ported-from tests/automation/utilities/rename_group.ts
// @port-kind   verbatim
import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { Conversation, ConversationSettings, Global } from './locators';
import {
  clickOn,
  clickOnMatchingText,
  pasteIntoInput,
  waitForMatchingText,
  waitForTestIdWithText,
} from './utils';

export const renameGroup = async (window: Page, oldGroupName: string, newGroupName: string) => {
  await clickOnMatchingText(window, oldGroupName);
  await clickOn(window, Conversation.conversationSettingsIcon);
  await clickOn(window, ConversationSettings.editGroupButton);
  await pasteIntoInput(window, 'update-group-info-name-input', newGroupName);
  await window.keyboard.press('Enter');
  await clickOnMatchingText(window, tStripped('save'));
  await waitForTestIdWithText(window, 'group-name', newGroupName);
  await clickOn(window, Global.modalCloseButton);
  // Check config message
  await waitForMatchingText(window, tStripped('groupNameNew', { group_name: newGroupName }), 5_000);
};
