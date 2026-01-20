import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
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

// TODO proper locator classes, test.steps
async function addAccountIDToGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Group to test adding contact';
  const {
    devices: { alice1, bob1, charlie1, unknown1 },
    prebuilt: { alice },
  } = await open_Alice1_Bob1_Charlie1_Unknown1({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  const aliceTruncatedPubkey = truncatePubkey(alice.sessionId, platform);
  const historicMsg = `Hello from ${alice.userName}`;
  await alice1.sendMessage(historicMsg);
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, historicMsg))
    )
  );
  const userD = await newUser(unknown1, USERNAME.DRACULA);
  const userDTruncatedPubkey = truncatePubkey(userD.accountID, platform);
  const userDMsg = `Hello from ${userD.userName}`;
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
  // Leave Manage Members
  await alice1.navigateBack();
  // Leave Conversation Settings
  await alice1.navigateBack();
  // Check control messages
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForControlMessageToBePresent(
        englishStrippedStr('groupMemberNew').withArgs({ name: userDTruncatedPubkey }).toString(),
        20_000
      )
    )
  );
  await unknown1.clickOnElementAll(new MessageRequestsBanner(unknown1));
  await unknown1.clickOnElementAll(new MessageRequestItem(unknown1));
  await unknown1.waitForControlMessageToBePresent(
    englishStrippedStr('messageRequestGroupInvite')
      .withArgs({ name: aliceTruncatedPubkey, group_name: testGroupName })
      .toString()
  );
  await unknown1.clickOnElementAll(new AcceptMessageRequestButton(unknown1));
  await unknown1.waitForControlMessageToBePresent(englishStrippedStr('groupInviteYou').toString());
  await unknown1.verifyElementNotPresent(new MessageBody(unknown1, historicMsg));
  await unknown1.sendMessage(userDMsg);
  await Promise.all(
    [alice1, bob1, charlie1, unknown1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, userDMsg))
    )
  );
  await closeApp(alice1, bob1, charlie1, unknown1);
}
