import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings, MessageInput } from './locators/conversation';
import {
  ConfirmRemovalButton,
  GroupMember,
  ManageMembersMenuItem,
  RemoveMemberButton,
} from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Kick member',
  risk: 'medium',
  testCb: kickMember,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Edit Group',
  },
  allureDescription:
    'Verifies that a group member can be kicked from a group and that the kicked member is removed from the group.',
});

async function kickMember(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Kick member';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new ManageMembersMenuItem(alice1));
  await alice1.clickOnElementAll({ ...new GroupMember(alice1).build(USERNAME.BOB) });
  await alice1.clickOnElementAll(new RemoveMemberButton(alice1));
  await alice1.checkModalStrings(
    englishStrippedStr('remove').toString(),
    englishStrippedStr('groupRemoveDescription')
      .withArgs({ name: USERNAME.BOB, group_name: testGroupName })
      .toString()
  );
  await alice1.clickOnElementAll(new ConfirmRemovalButton(alice1));
  // The Group Member element sometimes disappears slowly, sometimes quickly.
  // hasElementBeenDeleted would be theoretically better but we just check if element is not there anymore
  await alice1.verifyElementNotPresent({
    ...new GroupMember(alice1).build(USERNAME.BOB),
    maxWait: 5_000,
  });
  await alice1.navigateBack();
  await alice1.navigateBack();
  await Promise.all([
    alice1.waitForControlMessageToBePresent(
      englishStrippedStr('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
    charlie1.waitForControlMessageToBePresent(
      englishStrippedStr('groupRemoved').withArgs({ name: USERNAME.BOB }).toString()
    ),
  ]);
  await bob1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
    text: englishStrippedStr('groupRemovedYou').withArgs({ group_name: testGroupName }).toString(),
  });
  await bob1.onIOS().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Empty list',
  });
  // Message input should not be present after being kicked
  await bob1.verifyElementNotPresent({ ...new MessageInput(bob1).build(), maxWait: 1000 });
}
