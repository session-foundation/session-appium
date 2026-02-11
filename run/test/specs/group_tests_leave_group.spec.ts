import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupConfirm, LeaveGroupMenuItem } from './locators/groups';
import { ConversationItem } from './locators/home';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { sleepFor } from './utils/index';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Leave group',
  risk: 'high',
  testCb: leaveGroup,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription: 'Verifies that a non-admin member can leave a group successfully via the UI',
});

async function leaveGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Leave group';

  const {
    devices: { alice1, bob1, charlie1 },
    prebuilt: { charlie },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  await charlie1.clickOnElementAll(new ConversationSettings(charlie1));
  await sleepFor(1000);
  await charlie1.clickOnElementAll(new LeaveGroupMenuItem(charlie1));
  // Modal with Leave/Cancel
  await charlie1.checkModalStrings(
    tStripped('groupLeave'),
    tStripped('groupLeaveDescription', { group_name: testGroupName })
  );
  await charlie1.clickOnElementAll(new LeaveGroupConfirm(charlie1));
  // Check for control message
  const groupMemberLeft = tStripped('groupMemberLeft', { name: charlie.userName });
  await alice1.waitForControlMessageToBePresent(groupMemberLeft);
  await bob1.waitForControlMessageToBePresent(groupMemberLeft);
  // Check device 3 that group has disappeared
  await charlie1.verifyElementNotPresent({
    ...new ConversationItem(charlie1, testGroupName).build(),
    maxWait: 5000,
  });
  await closeApp(alice1, bob1, charlie1);
}
