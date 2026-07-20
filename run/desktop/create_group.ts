// @ported-from tests/automation/setup/create_group.ts
// @port-kind   verbatim
import { Page } from '@playwright/test';

import { tStripped } from '../localizer/lib';
import { openConversationWith } from './conversation';
import { HomeScreen } from './locators';
import { sendMessage } from './message';
import { sortByPubkey } from './pubkey';
import { sendNewMessage } from './send_message';
import { Group, User } from './types';
import {
  clickOn,
  clickOnMatchingText,
  pasteIntoInput,
  waitForTestIdWithText,
  waitForTextMessages,
} from './utils';

export const createGroup = async (
  userName: string,
  userOne: User,
  windowA: Page,
  userTwo: User,
  windowB: Page,
  userThree: User,
  windowC: Page
): Promise<Group> => {
  const group: Group = { userName, userOne, userTwo, userThree };

  const actionsToDo = [
    { window: windowA, sender: userOne, receivers: [userTwo, userThree] },
    { window: windowB, sender: userTwo, receivers: [userOne, userThree] },
    { window: windowC, sender: userThree, receivers: [userOne, userTwo] },
  ];
  // make everyone a friend of everyone, by sending a message to each other
  // Note: we need to do one send per window to avoid race conditions
  await Promise.all(
    actionsToDo.map(async action =>
      sendNewMessage(
        action.window,
        action.receivers[0].accountid,
        `${action.sender.userName} to ${action.receivers[0].userName}`
      )
    )
  );
  // once the first batch is sent, we can start the second batch
  await Promise.all(
    actionsToDo.map(async action =>
      sendNewMessage(
        action.window,
        action.receivers[1].accountid,
        `${action.sender.userName} to ${action.receivers[1].userName}`
      )
    )
  );

  // Click new closed group tab
  await clickOn(windowA, HomeScreen.plusButton);
  await clickOn(windowA, HomeScreen.createGroupOption);
  // Enter group name
  await pasteIntoInput(windowA, HomeScreen.createGroupGroupName.selector, group.userName);
  // Select user B
  await clickOnMatchingText(windowA, userTwo.userName);
  // Select user C
  await clickOnMatchingText(windowA, userThree.userName);
  // Click Next
  await clickOn(windowA, HomeScreen.createGroupCreateButton);
  // Check group was successfully created
  await clickOnMatchingText(windowB, group.userName);
  await waitForTestIdWithText(windowB, 'header-conversation-name', group.userName);
  // Need to sort users by pubkey
  const [firstUser, secondUser] = sortByPubkey(userTwo, userThree);
  // Make sure the empty state is in windowA
  // Updated in group v2
  await waitForTestIdWithText(
    windowA,
    'group-update-message',
    tStripped('groupMemberNewTwo', { name: firstUser, other_name: secondUser })
  );
  // Click on test group
  await Promise.all([windowB, windowC].map(w => openConversationWith(w, group.userName)));
  // Make sure the empty state is in windowB & windowC
  await Promise.all([
    waitForTestIdWithText(
      windowB,
      'group-update-message',
      tStripped('groupInviteYouAndOtherNew', {
        other_name: userThree.userName,
      })
    ),
    waitForTestIdWithText(
      windowC,
      'group-update-message',
      tStripped('groupInviteYouAndOtherNew', { other_name: userTwo.userName })
    ),
  ]);

  const msgsSent = await Promise.all(
    [[windowA, userOne] as const, [windowB, userTwo] as const, [windowC, userThree] as const].map(
      async ([w, u]) => {
        const msgToGroup = `${u.userName} to ${group.userName}`;
        await sendMessage(w, msgToGroup);
        await clickOnMatchingText(w, msgToGroup);
        return msgToGroup;
      }
    )
  );

  // Verify that each messages was received by the other two accounts

  // windowA should see the message from B and the message from C
  await waitForTextMessages(windowA, [msgsSent[1], msgsSent[2]]);

  // windowB should see the message from A and the message from C
  await waitForTextMessages(windowB, [msgsSent[0], msgsSent[2]]);

  // windowC must see the message from A and the message from B
  await waitForTextMessages(windowC, [msgsSent[0], msgsSent[1]]);

  return { userName, userOne, userTwo, userThree };
};
