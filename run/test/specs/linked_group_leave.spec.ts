import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupConfirm, LeaveGroupMenuItem } from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice2_Bob1_friends_group } from './state_builder';
import { sleepFor } from './utils';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Leave group linked device',
  risk: 'high',
  testCb: leaveGroupLinkedDevice,
  countOfDevicesNeeded: 3,
});

async function leaveGroupLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Linked device group';
  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo: testInfo,
  });
  await bob1.clickOnElementAll(new ConversationSettings(bob1));
  await sleepFor(1000);
  await bob1.clickOnElementAll(new LeaveGroupMenuItem(bob1));
  await bob1.checkModalStrings(
    englishStrippedStr('groupLeave').toString(),
    englishStrippedStr('groupLeaveDescription').withArgs({ group_name: testGroupName }).toString()
  );
  await bob1.clickOnElementAll(new LeaveGroupConfirm(bob1));
  await bob1.verifyElementNotPresent(new ConversationItem(bob1, testGroupName));
  const groupMemberLeft = englishStrippedStr('groupMemberLeft')
    .withArgs({ name: bob.userName })
    .toString();
  await Promise.all([
    alice1.waitForControlMessageToBePresent(groupMemberLeft),
    alice2.waitForControlMessageToBePresent(groupMemberLeft),
  ]);
  await closeApp(alice1, alice2, bob1);
}
