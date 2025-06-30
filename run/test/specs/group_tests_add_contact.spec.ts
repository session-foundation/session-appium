import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { InviteContactsButton, InviteContactsMenuItem } from './locators';
import { ConversationSettings } from './locators/conversation';
import { Contact } from './locators/global';
import { InviteContactConfirm, ManageMembersMenuItem } from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_Charlie1_Unknown1 } from './state_builder';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Add contact to group',
  risk: 'high',
  testCb: addContactToGroup,
  countOfDevicesNeeded: 4,
});
async function addContactToGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  await alice1.onIOS().clickOnElementAll(new InviteContactsMenuItem(alice1));
  await alice1.onAndroid().clickOnElementAll(new InviteContactsButton(alice1));
  // Select new user
  await alice1.clickOnElementAll({
    ...new Contact(alice1).build(),
    text: USERNAME.DRACULA,
  });
  await alice1.clickOnElementAll(new InviteContactConfirm(alice1));
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
  // Leave Message Requests screen (Android)
  await unknown1.onAndroid().navigateBack();
  await unknown1.selectByText('Conversation list item', group.groupName);
  // Check for control message on device 4
  await unknown1.waitForControlMessageToBePresent(englishStrippedStr('groupInviteYou').toString());
  await closeApp(alice1, bob1, charlie1, unknown1);
}
