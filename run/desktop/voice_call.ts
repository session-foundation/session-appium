import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { sleepFor } from '../shared/promise_utils';
import { Conversation, Global, Settings } from './locators';
import { checkModalStrings, clickOn, clickOnMatchingText } from './utils';

export const makeVoiceCall = async (callerWindow: Page, receiverWindow: Page) => {
  await clickOn(callerWindow, Conversation.callButton);
  await clickOn(callerWindow, Global.toast);
  await clickOn(callerWindow, Settings.enableCalls);
  await checkModalStrings(
    callerWindow,
    tStripped('callsVoiceAndVideoBeta'),
    tStripped('callsVoiceAndVideoModalDescription'),
    'confirmModal'
  );
  await clickOn(callerWindow, Global.confirmButton);
  await clickOn(callerWindow, Global.modalCloseButton);
  await clickOn(callerWindow, Conversation.callButton);
  // Enable calls in window B
  await clickOn(receiverWindow, Global.toast);
  await clickOn(receiverWindow, Settings.enableCalls);
  await checkModalStrings(
    receiverWindow,
    tStripped('callsVoiceAndVideoBeta'),
    tStripped('callsVoiceAndVideoModalDescription'),
    'confirmModal'
  );
  await clickOn(receiverWindow, Global.confirmButton);
  await clickOnMatchingText(receiverWindow, tStripped('accept'));
  await clickOn(receiverWindow, Global.modalCloseButton);
  await sleepFor(5000);
  await clickOn(callerWindow, Conversation.endCallButton);
};
