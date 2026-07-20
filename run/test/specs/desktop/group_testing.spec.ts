// @ported-from tests/automation/group_testing.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of raw Playwright Pages.

import { createGroup } from '../../../desktop/create_group';
import { Conversation, ConversationSettings, Global } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import {
  sessionTestThreeWindows,
  test_group_Alice_1W_Bob_1W_Charlie_1W,
  test_group_Alice_1W_Bob_1W_Charlie_1W_Dracula_1W,
} from '../../../desktop/sessionTest';
import { grabTextFromElement } from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

// Note: Note using the group fixture here as we want to test it thoroughly
sessionTestThreeWindows('Create group', async ([alice, bob, charlie]) => {
  // Open Electron
  const [userA, userB, userC] = await Promise.all([
    alice.onboard('Alice'),
    bob.onboard('Bob'),
    charlie.onboard('Charlie'),
  ]);

  await createGroup(
    'Test for group creation',
    userA,
    alice.getPage(),
    userB,
    bob.getPage(),
    userC,
    charlie.getPage()
  );
  // Check config messages in all windows
  await sleepFor(1000);
  // await waitForTestIdWithText(windowA, 'control-message');
});

test_group_Alice_1W_Bob_1W_Charlie_1W_Dracula_1W(
  'Add contact to group',
  async ({ alice, bob, charlie, dracula, groupCreated }) => {
    await alice.createContactWith(dracula);

    await alice.openConversationWith(groupCreated.userName);
    await alice.clickOnElement({
      strategy: 'data-testid',
      selector: 'conversation-options-avatar',
    });
    await alice.clickOnElement({
      strategy: 'data-testid',
      selector: 'invite-contacts-menu-option',
    });
    // Waiting for animation of right panel to appear
    await sleepFor(1000);
    await alice.clickOnMatchingText(dracula.userName);
    await alice.clickOnMatchingText(tStripped('membersInviteTitle'));
    // even if Bob and Charlie do not know Dracula's name,
    // Alice sets Dracula's name in the group members that every one will use as a fallback
    await Promise.all(
      [alice, bob, charlie].map(w =>
        w.waitForTestIdWithText(
          'group-update-message',
          tStripped('groupMemberNew', { name: dracula.userName })
        )
      )
    );
    await dracula.openConversationWith(groupCreated.userName);
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Change group name',
  async ({ alice, bob, charlie, groupCreated }) => {
    const newGroupName = 'New group name';
    const expectedError = tStripped('groupNameEnterPlease');
    // Change the name of the group and check that it syncs to all devices (config messages)
    // Click on already created group
    // Check that renaming a group is working
    await alice.renameGroup(groupCreated.userName, newGroupName);
    // Check config message in window B for group name change
    await bob.clickOnMatchingText(newGroupName);
    await bob.waitForMatchingText(tStripped('groupNameNew', { group_name: newGroupName }), 15_000);
    await charlie.clickOnMatchingText(newGroupName);
    await charlie.waitForMatchingText(
      tStripped('groupNameNew', { group_name: newGroupName }),
      15_000
    );
    // Click on conversation options
    // Check to see that you can't change group name to empty string
    // Click on edit group name
    await alice.clickOn(Conversation.conversationSettingsIcon);
    await alice.clickOn(ConversationSettings.editGroupButton);
    await alice.clickOn(ConversationSettings.clearGroupNameButton);
    await alice.waitForTestIdWithText(Global.errorMessage.selector);
    const actualError = await grabTextFromElement(
      alice.getPage(),
      'data-testid',
      Global.errorMessage.selector
    );
    if (actualError !== expectedError) {
      throw new Error(`Expected error message: ${expectedError}, but got: ${actualError}`);
    }
    await alice.clickOnMatchingText(tStripped('cancel'));
    await alice.clickOn(Global.modalCloseButton);
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Test mentions',
  async ({ alice, bob, charlie, groupCreated }) => {
    const members = [
      { user: alice, window: alice, others: [bob, charlie] },
      { user: bob, window: bob, others: [alice, charlie] },
      { user: charlie, window: charlie, others: [alice, bob] },
    ];

    // All users open group conversation
    await Promise.all(members.map(m => m.window.openConversationWith(groupCreated.userName)));

    // All users type @ to open mentions
    await Promise.all(members.map(m => m.window.pasteIntoInput('message-input-text-area', '@')));

    // All users check mentions dropdown shows "You" + other members
    await Promise.all(
      members.flatMap(m =>
        ['You', ...m.others.map(o => o.userName)].map(name =>
          m.window.waitForTestIdWithText('mentions-container-row', name)
        )
      )
    );

    // All users click on next member (Alice→Bob, Bob→Charlie, Charlie→Alice) and send
    await Promise.all(
      members.map(async (m, i) => {
        await m.window.clickOnWithText(
          Conversation.mentionsItem,
          members[(i + 1) % members.length].user.userName
        );
        await m.window.clickOn(Conversation.sendMessageButton);
      })
    );

    // All users should see all mentions ("You" for their own tag, names for others)
    await Promise.all(
      members.flatMap(m =>
        ['You', ...m.others.map(o => o.userName)].map(text => m.window.waitForTextMessage(text))
      )
    );
  }
);

test_group_Alice_1W_Bob_1W_Charlie_1W(
  'Leave group',
  async ({ alice, bob, charlie, groupCreated }) => {
    await charlie.leaveGroup(groupCreated);
    await Promise.all([
      alice.waitForTestIdWithText(
        'group-update-message',
        tStripped('groupMemberLeft', { name: charlie.userName })
      ),
      bob.waitForTestIdWithText(
        'group-update-message',
        tStripped('groupMemberLeft', { name: charlie.userName })
      ),
    ]);
  }
);
