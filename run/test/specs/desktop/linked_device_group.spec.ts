// @ported-from tests/automation/linked_device_group.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { DesktopWrapper } from '../../../desktop/DesktopWrapper';
import {
  Conversation,
  ConversationSettings,
  Global,
  HomeScreen,
  LeftPane,
  Settings,
} from '../../../desktop/locators';
import { openAppsAndWaitWindows } from '../../../desktop/open';
import { recoverFromSeed } from '../../../desktop/recovery_using_seed';
import {
  test_group_Alice_1W_Bob_1W_Charlie_1W,
  test_group_Alice_2W_Bob_1W_Charlie_1W,
} from '../../../desktop/sessionTest';
import { hasElementBeenDeleted } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

test_group_Alice_2W_Bob_1W_Charlie_1W(
  'Leaving group syncs',
  async ({ alice, alice2, bob, charlie, groupCreated }) => {
    // Check group conversation is in conversation list of linked device
    await alice2.waitForTestIdWithText(
      'module-conversation__user__profile-name',
      groupCreated.userName
    );
    // User C to leave group
    await charlie.leaveGroup(groupCreated);
    // Check for user A for control message that userC left group
    // await sleepFor(1000);
    // Click on group
    await alice.openConversationWith(groupCreated.userName);

    await alice.waitForTestIdWithText(
      'group-update-message',
      tStripped('groupMemberLeft', {
        name: charlie.userName,
      })
    );
    // Check for linked device (userA)
    await alice2.openConversationWith(groupCreated.userName);
    await alice2.waitForTestIdWithText(
      'group-update-message',
      tStripped('groupMemberLeft', {
        name: charlie.userName,
      })
    );
    // Check for user B
    await bob.waitForTestIdWithText(
      'group-update-message',
      tStripped('groupMemberLeft', {
        name: charlie.userName,
      })
    );
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Restore group',
  async ({ alice, bob, charlie, groupCreated }) => {
    const [aliceWindow2Page] = await openAppsAndWaitWindows(1);
    const aliceWindow2 = new DesktopWrapper(aliceWindow2Page);
    // Check group conversation is in conversation list on linked device
    // Restore account on a linked device
    await recoverFromSeed(aliceWindow2.getPage(), alice.getUser().recoveryPassword);
    // Does group appear?
    await aliceWindow2.waitForTestIdWithText(
      HomeScreen.conversationItemName.selector,
      groupCreated.userName
    );
    // Check group for members, conversation name and messages
    await aliceWindow2.openConversationWith(groupCreated.userName);

    // Check header name
    await aliceWindow2.waitForTestIdWithText(
      Conversation.conversationHeader.selector,
      groupCreated.userName
    );
    // Check for group members
    await aliceWindow2.clickOn(Conversation.conversationSettingsIcon);
    // Check right panel has correct name
    await aliceWindow2.waitForTestIdWithText('group-name');
    await aliceWindow2.clickOn(ConversationSettings.manageMembersOption);
    await aliceWindow2.waitForTestIdWithText('modal-heading', tStripped('manageMembers'));
    // Check for You, Bob and Charlie
    await Promise.all([
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, tStripped('you')),
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, charlie.userName),
    ]);
  }
);

async function clearDataOnWindow(window: DesktopWrapper) {
  await window.clickOn(LeftPane.settingsButton);
  // Click on clear data option on left pane
  await window.clickOnWithText(Settings.clearDataMenuItem, tStripped('sessionClearData'));
  await window.checkModalStrings(
    tStripped('clearDataAll'),
    tStripped('clearDataAllDescription'),
    'deleteAccountModal'
  );
  await window.clickOnWithText(Global.confirmButton, tStripped('clear'));
  await window.checkModalStrings(
    tStripped('clearDataAll'),
    tStripped('clearDeviceDescription'),
    'deleteAccountModal'
  );
  await window.clickOnMatchingText(tStripped('clear'));
}

// Delete device data > Restore account
test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Delete and restore group',
  async ({ alice, bob, charlie, groupCreated }) => {
    const [aliceWindow2Page] = await openAppsAndWaitWindows(1);
    const aliceWindow2 = new DesktopWrapper(aliceWindow2Page);
    // Check group conversation is in conversation list on linked device
    // Restore account on a linked device
    await recoverFromSeed(aliceWindow2.getPage(), alice.getUser().recoveryPassword);
    // Does group appear?
    await aliceWindow2.waitForTestIdWithText(
      HomeScreen.conversationItemName.selector,
      groupCreated.userName
    );
    // Check group for members, conversation name and messages
    await aliceWindow2.openConversationWith(groupCreated.userName);
    // Check header name
    await aliceWindow2.waitForTestIdWithText(
      Conversation.conversationHeader.selector,
      groupCreated.userName
    );
    // Check for group members
    await aliceWindow2.clickOn(Conversation.conversationSettingsIcon);
    await aliceWindow2.clickOn(ConversationSettings.manageMembersOption);
    // Check for You, Bob and Charlie
    await Promise.all([
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, tStripped('you')),
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
      aliceWindow2.waitForTestIdWithText(Global.contactItem.selector, charlie.userName),
    ]);
    await aliceWindow2.clickOn(Global.cancelButton);
    await aliceWindow2.clickOn(Global.modalCloseButton);
    // Delete device data on aliceWindow2
    await clearDataOnWindow(aliceWindow2);
    const [restoredWindowPage] = await openAppsAndWaitWindows(1);
    const restoredWindow = new DesktopWrapper(restoredWindowPage);
    await recoverFromSeed(restoredWindow.getPage(), alice.getUser().recoveryPassword);
    // Does group appear?
    await restoredWindow.waitForTestIdWithText(
      HomeScreen.conversationItemName.selector,
      groupCreated.userName
    );
    // Check group for members, conversation name and messages
    await restoredWindow.openConversationWith(groupCreated.userName);
    // Check header name
    await restoredWindow.waitForTestIdWithText(
      Conversation.conversationHeader.selector,
      groupCreated.userName
    );
    // Check for group members
    await restoredWindow.clickOn(Conversation.conversationSettingsIcon);
    await restoredWindow.clickOn(ConversationSettings.manageMembersOption);
    // Check for You, Bob and Charlie
    await Promise.all([
      restoredWindow.waitForTestIdWithText(Global.contactItem.selector, tStripped('you')),
      restoredWindow.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
      restoredWindow.waitForTestIdWithText(Global.contactItem.selector, charlie.userName),
    ]);
    // Do it all again
    await restoredWindow.clickOn(Global.cancelButton);
    await restoredWindow.clickOn(Global.modalCloseButton);
    // Delete device data on restoredWindow
    await clearDataOnWindow(restoredWindow);
    const [restoredWindow2Page] = await openAppsAndWaitWindows(1);
    const restoredWindow2 = new DesktopWrapper(restoredWindow2Page);
    await recoverFromSeed(restoredWindow2.getPage(), alice.getUser().recoveryPassword);
    // Does group appear?
    await restoredWindow2.waitForTestIdWithText(
      HomeScreen.conversationItemName.selector,
      groupCreated.userName
    );
    // Check group for members, conversation name and messages
    await restoredWindow2.openConversationWith(groupCreated.userName);
    // Check header name
    await restoredWindow2.waitForTestIdWithText(
      Conversation.conversationHeader.selector,
      groupCreated.userName
    );
    // Check for group members
    await restoredWindow2.clickOn(Conversation.conversationSettingsIcon);
    await restoredWindow2.clickOn(ConversationSettings.manageMembersOption);
    // Check for You, Bob and Charlie
    await Promise.all([
      restoredWindow2.waitForTestIdWithText(Global.contactItem.selector, tStripped('you')),
      restoredWindow2.waitForTestIdWithText(Global.contactItem.selector, bob.userName),
      restoredWindow2.waitForTestIdWithText(Global.contactItem.selector, charlie.userName),
    ]);
  }
);

test_group_Alice_2W_Bob_1W_Charlie_1W(
  'Delete group linked device',
  async ({ alice, alice2, bob, charlie, groupCreated }) => {
    await alice.clickOn(Conversation.conversationSettingsIcon);
    await alice.clickOn(ConversationSettings.leaveOrDeleteGroupOption);
    await alice.checkModalStrings(
      tStripped('groupDelete'),
      tStripped('groupDeleteDescription', {
        group_name: groupCreated.userName,
      }),
      'confirmModal'
    );
    await alice.clickOn(Global.confirmButton);
    await Promise.all(
      [bob, charlie].map(async w => {
        await w.waitForTestIdWithText(
          'empty-conversation-control-message',
          tStripped('groupDeletedMemberDescription', {
            group_name: groupCreated.userName,
          })
        );
      })
    );
    await Promise.all(
      [alice, alice2].map(async w => {
        await hasElementBeenDeleted(w.getPage(), HomeScreen.conversationItemName, {
          maxWait: 10_000,
          text: groupCreated.userName,
        });
      })
    );
  }
);
