import type { StateUser } from '@session-foundation/qa-seeder';
// Only import paths were rewritten to `./` siblings.

import { Page } from '@playwright/test';

import { sendNewMessage } from './send_message';

export const createContact = async (
  windowA: Page,
  windowB: Page,
  userA: StateUser,
  userB: StateUser
) => {
  const start = Date.now();
  const testMessage = `${userA.userName} to ${userB.userName}`;
  const testReply = `${userB.userName} to ${userA.userName}`;
  // User A sends message to User B
  await Promise.all([
    sendNewMessage(windowA, userB.sessionId, testMessage),
    sendNewMessage(windowB, userA.sessionId, testReply),
  ]);
  console.warn(`createContact took ${Date.now() - start}ms`);
};
