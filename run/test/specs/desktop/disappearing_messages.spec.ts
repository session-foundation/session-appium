// @ported-from tests/automation/disappearing_messages.spec.ts
// @port-kind   spec
// Rewritten to drive the app through DesktopWrapper instead of a raw Playwright Page.

import { defaultDisappearingOptions } from '../../../desktop/constants/variables';
import { Conversation, Global } from '../../../desktop/locators';
import { sleepFor } from '../../../desktop/promise_utils';
import {
  test_Alice_2W,
  test_Alice_2W_Bob_1W,
  test_group_Alice_2W_Bob_1W_Charlie_1W,
} from '../../../desktop/sessionTest';
import {
  doesTextIncludeString,
  formatTimeOption,
  hasElementBeenDeleted,
  hasTextMessageBeenDeleted,
} from '../../../desktop/utils';
import { tStripped } from '../../../localizer/lib';

test_Alice_2W_Bob_1W('Disappear after read 1:1', async ({ alice, alice2, bob }) => {
  const { timeOption, disappearingMessagesType, disappearAction } = defaultDisappearingOptions.DAR;
  const formattedTime = formatTimeOption(timeOption);
  const testMessage = 'Testing disappearing messages timer is working correctly';
  const controlMessage = tStripped('disappearingMessagesSetYou', {
    time: formattedTime,
    disappearing_messages_type: tStripped('disappearingMessagesTypeRead'),
  });
  // Create Contact
  await alice.createContactWith(bob);
  // Click on conversation in linked device
  await alice2.openConversationWith(bob.userName);

  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );

  // Check control message is visible
  await doesTextIncludeString(alice.getPage(), 'disappear-control-message', controlMessage);
  await sleepFor(10000);
  // Control message should also disappear after 10 seconds
  await hasTextMessageBeenDeleted(alice.getPage(), controlMessage);
  // Send message
  await alice.sendMessage(testMessage);
  // Check window B for message to confirm arrival
  // await clickOnTextMessage(bobWindow1, testMessage);
  await bob.waitForTextMessage(testMessage);
  // Wait 10 seconds to see if message is removed
  await sleepFor(10000);
  await hasTextMessageBeenDeleted(alice.getPage(), testMessage);
  // Check window B (need to refocus window)
  console.log(`Bring window B to front`);
  const message = 'Forcing window to front';
  await bob.pasteIntoInput('message-input-text-area', message);
  // click up arrow (send)
  await bob.clickOn(Conversation.sendMessageButton);
  await sleepFor(10000);
  await hasTextMessageBeenDeleted(bob.getPage(), testMessage);
});

test_Alice_2W_Bob_1W('Disappear after send 1:1', async ({ alice, alice2, bob }) => {
  const { timeOption, disappearingMessagesType, disappearAction } = defaultDisappearingOptions.DAS;
  const formattedTime = formatTimeOption(timeOption);
  const testMessage = 'Testing disappearing messages timer is working correctly';
  const controlMessage = tStripped('disappearingMessagesSetYou', {
    time: formattedTime,
    disappearing_messages_type: tStripped('disappearingMessagesTypeSent'),
  });
  // Create Contact
  await alice.createContactWith(bob);

  // Click on conversation in linked device
  await alice2.openConversationWith(bob.userName);
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  // Check control message is correct and appearing
  await alice.waitForTestIdWithText('disappear-control-message', controlMessage);
  await alice.sendMessage(testMessage);
  // Check message has appeared in receivers window and linked device
  await Promise.all([bob.waitForTextMessage(testMessage), alice2.waitForTextMessage(testMessage)]);
  // Wait 30 seconds for message to disappearing (should disappear on all devices at once)
  await sleepFor(30000);
  await Promise.all([
    hasTextMessageBeenDeleted(alice.getPage(), testMessage),
    hasTextMessageBeenDeleted(bob.getPage(), testMessage),
    hasTextMessageBeenDeleted(alice2.getPage(), testMessage),
  ]);
});

test_group_Alice_2W_Bob_1W_Charlie_1W(
  'Disappear after send groups',
  async ({ alice, alice2, bob, charlie, groupCreated }) => {
    const { timeOption, disappearingMessagesType, disappearAction } =
      defaultDisappearingOptions.group;
    const formattedTime = formatTimeOption(timeOption);
    const controlMessage = tStripped('disappearingMessagesSetYou', {
      time: formattedTime,
      disappearing_messages_type: tStripped('disappearingMessagesTypeSent'),
    });
    const testMessage = 'Testing disappearing messages in groups';

    await alice2.openConversationWith(groupCreated.userName);
    await alice.setDisappearingMessages([
      'group',
      disappearingMessagesType,
      timeOption,
      disappearAction,
    ]);
    // Check control message is visible and correct
    await doesTextIncludeString(alice.getPage(), 'disappear-control-message', controlMessage);
    await alice.sendMessage(testMessage);
    await Promise.all([
      bob.waitForTextMessage(testMessage),
      charlie.waitForTextMessage(testMessage),
      alice2.waitForTextMessage(testMessage),
    ]);
    // Wait 10 seconds for messages to disappear
    await sleepFor(10000);
    await Promise.all([
      hasTextMessageBeenDeleted(alice.getPage(), testMessage),
      hasTextMessageBeenDeleted(bob.getPage(), testMessage),
      hasTextMessageBeenDeleted(charlie.getPage(), testMessage),
      hasTextMessageBeenDeleted(alice2.getPage(), testMessage),
    ]);
  }
);

test_Alice_2W('Disappear after send note to self', async ({ alice, alice2 }) => {
  const { timeOption, disappearingMessagesType, disappearAction } = defaultDisappearingOptions.NTS;
  const testMessage = 'Message to test note to self';
  const testMessageDisappear = 'Message testing disappearing messages';
  const formattedTime = formatTimeOption(timeOption);
  const controlMessage = tStripped('disappearingMessagesSetYou', {
    time: formattedTime,
    disappearing_messages_type: tStripped('disappearingMessagesTypeSent'),
  });
  // Open Note to self conversation
  await alice.sendNewMessage(alice.accountId, testMessage);
  // Check messages are syncing across linked devices
  await alice2.openConversationWith(tStripped('noteToSelf'));
  await alice2.waitForTextMessage(testMessage);
  // Enable disappearing messages
  await alice.setDisappearingMessages([
    'note-to-self',
    disappearingMessagesType,
    timeOption,
    disappearAction,
  ]);
  // Check control message is visible and correct
  await doesTextIncludeString(alice.getPage(), 'disappear-control-message', controlMessage);
  await alice.sendMessage(testMessageDisappear);
  await alice2.waitForTextMessage(testMessageDisappear);
  await Promise.all([
    hasTextMessageBeenDeleted(alice.getPage(), testMessageDisappear, 10_000),
    hasTextMessageBeenDeleted(alice2.getPage(), testMessageDisappear, 10_000),
  ]);
});

test_Alice_2W_Bob_1W('Disappear after send off 1:1', async ({ alice, alice2, bob }) => {
  const { disappearAction, disappearingMessagesType, timeOption } = defaultDisappearingOptions.DAS;
  const testMessage = 'Turning disappearing messages off';
  const formattedTime = formatTimeOption(timeOption);
  await alice.createContactWith(bob);
  // Click on conversation on linked device
  await alice2.openConversationWith(bob.userName);
  // Set disappearing messages to on
  await alice.setDisappearingMessages(
    ['1:1', disappearingMessagesType, timeOption, disappearAction],
    bob
  );
  // Check control message is visible and correct
  const controlMessage = tStripped('disappearingMessagesSetYou', {
    time: formattedTime,
    disappearing_messages_type: tStripped('disappearingMessagesTypeSent'),
  });
  await Promise.all([
    alice.waitForTestIdWithText('disappear-control-message', controlMessage),
    alice2.waitForTestIdWithText('disappear-control-message', controlMessage),
    bob.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesSet', {
        name: alice.userName,
        time: formattedTime,
        disappearing_messages_type: tStripped('disappearingMessagesTypeSent'),
      })
    ),
  ]);
  await alice.sendMessage(testMessage);
  // Check message has appeared in receivers window and linked device
  await Promise.all([bob.waitForTextMessage(testMessage), alice2.waitForTextMessage(testMessage)]);
  await alice.clickOn(Conversation.conversationSettingsIcon, {
    maxWait: 1_000,
  });
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: 'disappearing-messages-menu-option',
    maxWait: 100,
  });
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: 'disappear-off-option',
  });
  await alice.clickOnElement({
    strategy: 'data-testid',
    selector: 'disappear-set-button',
  });
  // Select Follow setting in Bob's window
  await bob.clickOnMatchingText(tStripped('disappearingMessagesFollowSetting'));

  await bob.clickOn(Global.confirmButton);

  // Check control message are visible and correct
  // Each window has two control messages: You turned off and other user turned off (because we're following settings)
  await Promise.all([
    alice.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOffYou')
    ),
    alice.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOff', { name: bob.userName })
    ),
    alice2.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOffYou')
    ),
    alice2.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOff', { name: bob.userName })
    ),
    bob.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOff', { name: alice.userName })
    ),
    bob.waitForTestIdWithText(
      'disappear-control-message',
      tStripped('disappearingMessagesTurnedOffYou')
    ),
  ]);
  await Promise.all(
    [alice, alice2, bob].map(w =>
      hasElementBeenDeleted(w.getPage(), Conversation.DisappearMessagesTypeAndTime, {
        maxWait: 1_000,
      })
    )
  );
});
