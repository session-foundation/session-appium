import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../../localizer/lib';
import { bothPlatformsIt } from '../../../types/sessionIt';
import { DisappearActions, DISAPPEARING_TIMES, DisappearModes } from '../../../types/testing';
import { ConversationSettings } from '../../locators/conversation';
import {
  DisableDisappearingMessages,
  DisappearingMessagesMenuOption,
  DisappearingMessagesSubtitle,
  SetDisappearMessagesButton,
} from '../../locators/disappearing_messages';
import { open_Alice2_Bob1_friends } from '../../state_builder';
import { closeApp, SupportedPlatformsType } from '../../utils/open_app';
import { openConversation } from '../../utils/open_conversation';
import { setDisappearingMessage } from '../../utils/set_disappearing_messages';

bothPlatformsIt({
  title: 'Disappear after send off 1:1',
  risk: 'high',
  testCb: disappearAfterSendOff1o1,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Disappearing Messages',
    suite: 'Conversation Types',
  },
  allureDescription:
    'Verifies that turning off Disappearing Messages works as expected in a 1:1 conversation',
});

async function disappearAfterSendOff1o1(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

  const mode: DisappearModes = 'send';
  const controlMode: DisappearActions = 'sent';
  // Deliberately not getDisappearingTestTime(): this spec never waits for anything to expire, it
  // checks that turning the feature off syncs. A short timer is actively harmful here, because the
  // "You set messages to disappear ..." control message is itself subject to the timer it announces
  // — so the checks below race a countdown that starts the moment the setting is applied, and the
  // devices furthest from the action (linked device, recipient) are the ones that lose. A timer that
  // outlives the test removes the race without costing runtime.
  const time = DISAPPEARING_TIMES.ONE_WEEK;
  // Select disappearing messages option
  await setDisappearingMessage(alice1, ['1:1', `Disappear after ${mode} option`, time]);
  // Check control messages on both devices and sync to linked device
  const setYouMsg = tStripped('disappearingMessagesSetYou', {
    time,
    disappearing_messages_type: controlMode,
  });
  await Promise.all([
    alice1.waitForControlMessageToBePresent(setYouMsg),
    bob1.waitForControlMessageToBePresent(
      tStripped('disappearingMessagesSet', {
        name: alice.userName,
        time,
        disappearing_messages_type: controlMode,
      })
    ),
    openConversation(alice2, bob.userName).then(() =>
      alice2.waitForControlMessageToBePresent(setYouMsg)
    ),
  ]);

  // Turn off disappearing messages on device 1
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new DisappearingMessagesMenuOption(alice1));
  await alice1.clickOnElementAll(new DisableDisappearingMessages(alice1));
  await alice1.clickOnElementAll(new SetDisappearMessagesButton(alice1));
  await alice1.navigateBack();
  // Check control message for turning off disappearing messages
  // Check USER A'S CONTROL MESSAGE on device 1 and 3 (linked device)
  const disappearingMessagesTurnedOffYou = tStripped('disappearingMessagesTurnedOffYou');
  // Check USER B'S CONTROL MESSAGE
  const disappearingMessagesTurnedOff = tStripped('disappearingMessagesTurnedOff', {
    name: alice.userName,
  });
  await Promise.all([
    alice1.waitForControlMessageToBePresent(disappearingMessagesTurnedOffYou),
    bob1.waitForControlMessageToBePresent(disappearingMessagesTurnedOff),
    alice2.waitForControlMessageToBePresent(disappearingMessagesTurnedOffYou),
  ]);
  // Check conversation subtitle?
  await Promise.all(
    [alice1, bob1, alice2].map(device =>
      device.waitForElementToBeGone({
        ...new DisappearingMessagesSubtitle(device).build(),
        maxWait: 5_000,
      })
    )
  );
  await closeApp(alice1, bob1, alice2);
}
