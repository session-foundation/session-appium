import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { androidIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { InviteContactsMenuItem } from './locators';
import { ConversationSettings, MessageBody } from './locators/conversation';
import { Contact } from './locators/global';
import {
  InviteContactConfirm,
  ManageMembersMenuItem,
  ShareMessageHistoryRadial,
} from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_Charlie1_Unknown1 } from './state_builder';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

androidIt({
  title: 'Invite contact to group with chat history',
  risk: 'high',
  testCb: addContactToGroupHistory,
  countOfDevicesNeeded: 4,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that inviting a contact to a group with message history works as expected.',
});

// TODO proper locator classes, test.steps
async function addContactToGroupHistory(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Group to test adding contact';
  const {
    devices: { alice1, bob1, charlie1, unknown1 },
    prebuilt: { alice, group },
  } = await open_Alice1_Bob1_Charlie1_Unknown1({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  const historicMsg = `Hello from ${alice.userName}`;
  await alice1.sendMessage(historicMsg);
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, historicMsg))
    )
  );
  const userD = await newUser(unknown1, USERNAME.DRACULA);
  await alice1.navigateBack();
  await newContact(platform, alice1, alice, unknown1, userD);
  // Exit to conversation list
  await alice1.navigateBack();
  // Select group conversation in list
  await alice1.clickOnElementAll(new ConversationItem(alice1, testGroupName));
  // Click more options
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  // Select edit group
  await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
  await sleepFor(1000);
  // Add contact to group
  await alice1.clickOnElementAll(new InviteContactsMenuItem(alice1));
  // Select new user
  await alice1.clickOnElementAll({
    ...new Contact(alice1).build(),
    text: USERNAME.DRACULA,
  });
  await alice1.clickOnElementAll(new InviteContactConfirm(alice1));
  await alice1.clickOnElementAll(new ShareMessageHistoryRadial(alice1));
  await alice1.clickOnElementAll({
    strategy: 'id',
    selector: 'Send Invite',
  });
  // Leave Manage Members
  await alice1.navigateBack();
  // Leave Conversation Settings
  await alice1.navigateBack();
  // Check control messages
  await Promise.all(
    [alice1, bob1, charlie1].map(device =>
      device.waitForControlMessageToBePresent(
        englishStrippedStr('groupMemberNew').withArgs({ name: USERNAME.DRACULA }).toString()
      )
    )
  );
  // Leave conversation
  await unknown1.navigateBack();
  // Leave Message Requests screen
  await unknown1.navigateBack();
  await unknown1.clickOnElementAll(new ConversationItem(unknown1, group.groupName)); // Check for control message on device 4
  await unknown1.waitForTextElementToBePresent(new MessageBody(unknown1, historicMsg));
  await unknown1.waitForControlMessageToBePresent(englishStrippedStr('groupInviteYou').toString());
  await closeApp(alice1, bob1, charlie1, unknown1);
}
