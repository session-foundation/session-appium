// @ported-from tests/automation/community_admin_tests.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { testCommunityName } from '../../../desktop/constants/community';
import { assertAdminIsKnown } from '../../../desktop/join_community';
import { Conversation, Global, HomeScreen } from '../../../desktop/locators';
import { recoverFromSeed } from '../../../desktop/recovery_using_seed';
import { sessionTestTwoWindows } from '../../../desktop/sessionTest';
import { clickOnWithText, hasElementBeenDeleted } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

const banUserString = tStripped('banUser');
const unbanUserString = tStripped('banUnbanUser');

const actionsToDo = ['ban_unban', 'ban_delete_all'] as const;

actionsToDo.forEach(action => {
  sessionTestTwoWindows(`Community admin ${action}`, async ([alice1, bob1]) => {
    assertAdminIsKnown();
    const firstMsgNotBanned = `${action} me! - ${Date.now()}`;
    const secondMsgBanned = `I'm banned :( - ${Date.now()}`;
    const thirdMsgUnbanned = `Freedom! - ${Date.now()}`;

    const [_alice, bob] = await Promise.all([
      recoverFromSeed(alice1.getPage(), process.env.SOGS_ADMIN_SEED!, {
        fallbackName: 'Admin',
      }),
      bob1.onboard('Bob'),
    ]);
    await Promise.all([alice1.joinOrOpenCommunity(), bob1.joinCommunity()]);
    await bob1.sendMessage(firstMsgNotBanned);
    await alice1.scrollToBottomLookingForMessage(firstMsgNotBanned);
    await alice1.rightClickOnWithText(Conversation.messageContent, firstMsgNotBanned);
    await clickOnWithText(alice1.getPage(), Global.contextMenuItem, banUserString, {
      strictMode: false,
      maxWait: 1_00000,
    });
    if (action === 'ban_unban') {
      await alice1.clickOn(Conversation.banUserButton);
      await bob1.pasteIntoInput(Conversation.messageInput.selector, secondMsgBanned);
      await bob1.clickOn(Conversation.sendMessageButton);
      await bob1.waitForMessageStatus(secondMsgBanned, 'failed');
      await alice1.rightClickOnWithText(Conversation.messageContent, firstMsgNotBanned);
      await clickOnWithText(alice1.getPage(), Global.contextMenuItem, unbanUserString, {
        strictMode: false,
      });
      await alice1.clickOn(Conversation.unbanUserButton);
    } else {
      await alice1.clickOn(Conversation.banAndDeleteAllButton);
      await hasElementBeenDeleted(alice1.getPage(), Conversation.messageContent, {
        maxWait: 10_000,
        text: firstMsgNotBanned,
      });
      // Bob was banned, so he can't send a message
      await bob1.pasteIntoInput(Conversation.messageInput.selector, secondMsgBanned);
      await bob1.clickOn(Conversation.sendMessageButton);
      await bob1.waitForMessageStatus(secondMsgBanned, 'failed');
      await alice1.hasElementPoppedUpThatShouldnt(Conversation.messageContent, secondMsgBanned);
      // Alice unban Bob via the convo right click modal (as all messages from Bob have been removed)
      await alice1.rightClickOnWithText(HomeScreen.conversationItemName, testCommunityName);
      await clickOnWithText(alice1.getPage(), Global.contextMenuItem, unbanUserString, {
        strictMode: false,
      });
      await alice1.pasteIntoInput(Conversation.unbanUserInput.selector, bob.accountid);
      await alice1.clickOn(Conversation.unbanUserButton);
      await alice1.waitForTestIdWithText(Global.toast.selector, tStripped('banUnbanUserUnbanned'));
    }

    // here the user has been either
    // - ban & unbanned or
    // - banned_delete_all & unbanned
    // So he should be able to send a message again
    await bob1.sendMessage(thirdMsgUnbanned);
    await alice1.waitForTestIdWithText(Conversation.messageContent.selector, thirdMsgUnbanned);
  });
});
