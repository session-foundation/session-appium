import { test, type TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { TestSteps } from '../../types/allure';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { InviteAccountIDOrONS } from './locators';
import {
  AcceptMessageRequestButton,
  ConversationSettings,
  MessageBody,
} from './locators/conversation';
import {
  InviteContactSendInviteButton,
  ManageMembersMenuItem,
  ShareNewMessagesRadial,
} from './locators/groups';
import { MessageRequestItem, MessageRequestsBanner } from './locators/home';
import { EnterAccountID, NextButton } from './locators/start_conversation';
import { open_Alice1_Bob1_Charlie1_Unknown1 } from './state_builder';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { truncatePubkey } from './utils/get_account_id';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

androidIt({
  title: 'Invite Account ID to group',
  risk: 'high',
  testCb: addAccountIDToGroup,
  countOfDevicesNeeded: 4,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that inviting a non-contact Account ID (without chat history) works as expected.',
});

async function addAccountIDToGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Group to test adding contact';
  const {
    devices: { alice1, bob1, charlie1, unknown1 },
    prebuilt: { alice },
  } = await test.step(TestSteps.SETUP.QA_SEEDER, async () => {
    return open_Alice1_Bob1_Charlie1_Unknown1({
      platform,
      groupName: testGroupName,
      focusGroupConvo: true,
      testInfo: testInfo,
    });
  });
  const userD = await test.step(TestSteps.SETUP.NEW_USER, async () => {
    return newUser(unknown1, USERNAME.DRACULA);
  });
  const aliceTruncatedPubkey = truncatePubkey(alice.sessionId, platform);
  const historicMsg = `Hello from ${alice.userName}`;
  const userDTruncatedPubkey = truncatePubkey(userD.accountID, platform);
  const userDMsg = `Hello from ${userD.userName}`;
  await test.step(TestSteps.SEND.MESSAGE(alice.userName, 'group'), async () => {
    await alice1.sendMessage(historicMsg);
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.waitForTextElementToBePresent(new MessageBody(device, historicMsg))
      )
    );
  });
  await test.step(TestSteps.USER_ACTIONS.GROUPS_ADD_CONTACT(userD.userName), async () => {
    // Click more options
    await alice1.clickOnElementAll(new ConversationSettings(alice1));
    // Select edit group
    await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
    await sleepFor(1000);
    // Add contact to group
    await alice1.clickOnElementAll(new InviteAccountIDOrONS(alice1));
    await alice1.inputText(userD.accountID, new EnterAccountID(alice1));
    await alice1.clickOnElementAll(new NextButton(alice1));
    await alice1.clickOnElementAll(new ShareNewMessagesRadial(alice1));
    await alice1.clickOnElementAll(new InviteContactSendInviteButton(alice1));
  });
  // Leave Manage Members
  await alice1.navigateBack();
  // Leave Conversation Settings
  await alice1.navigateBack();
  // Check control messages
  await test.step('Verify group invite control message for all members', async () => {
    await Promise.all(
      [alice1, bob1, charlie1].map(device =>
        device.waitForControlMessageToBePresent(
          tStripped('groupMemberNew', { name: userDTruncatedPubkey }),
          20_000
        )
      )
    );
  });
  await test.step(`${userD.userName} accepts group invite and sends a message`, async () => {
    await unknown1.clickOnElementAll(new MessageRequestsBanner(unknown1));
    await unknown1.clickOnElementAll(new MessageRequestItem(unknown1));
    await unknown1.waitForControlMessageToBePresent(
      tStripped('messageRequestGroupInvite', {
        name: aliceTruncatedPubkey,
        group_name: testGroupName,
      })
    );
    await unknown1.clickOnElementAll(new AcceptMessageRequestButton(unknown1));
    await unknown1.waitForControlMessageToBePresent(tStripped('groupInviteYou'));
    await unknown1.verifyElementNotPresent(new MessageBody(unknown1, historicMsg));
    await unknown1.sendMessage(userDMsg);
    await Promise.all(
      [alice1, bob1, charlie1, unknown1].map(device =>
        device.waitForTextElementToBePresent(new MessageBody(device, userDMsg))
      )
    );
  });
  await test.step(TestSteps.SETUP.CLOSE_APP, async () => {
    await closeApp(alice1, bob1, charlie1, unknown1);
  });
}
