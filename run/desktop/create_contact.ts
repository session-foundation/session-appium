// Copied from session-playwright (tests/automation/utilities/create_contact.ts).
// Only import paths were rewritten to `./` siblings.

import { Page } from '@playwright/test';

import { sendNewMessage } from './send_message';
import { User } from './types';

export const createContact = async (windowA: Page, windowB: Page, userA: User, userB: User) => {
  const start = Date.now();
  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // User A sends message to User B
  await Promise.all([
    sendNewMessage(windowA, userB.accountid, testMessage),
    sendNewMessage(windowB, userA.accountid, testReply),
  ]);
  console.warn(`createContact took ${Date.now() - start}ms`);
};
