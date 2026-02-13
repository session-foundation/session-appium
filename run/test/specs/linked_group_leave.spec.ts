import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings } from '../locators/conversation';
import { LeaveGroupConfirm, LeaveGroupMenuItem } from '../locators/groups';
import { ConversationItem } from '../locators/home';
import { newUser } from '../utils/create_account';
import { createGroup } from '../utils/create_group';
import { linkedDevice } from '../utils/link_device';
import { closeApp, openAppFourDevices, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Leave group linked device',
  risk: 'high',
  testCb: leaveGroupLinkedDevice,
  countOfDevicesNeeded: 4,
  allureSuites: {
    parent: 'Groups',
    suite: 'Leave/Delete Group',
  },
  allureDescription: 'Verifies that leaving a group syncs to a linked device',
});

async function leaveGroupLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Leave group linked device';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  const [alice, bob, charlie] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    linkedDevice(device3, device4, USERNAME.CHARLIE),
  ]);
  // Create group with user A, user B and User C
  await createGroup(platform, device1, alice, device2, bob, device3, charlie, testGroupName);
  // If we know group is present on device4, we can check for just disappearance later (vs. hasElementBeenDeleted)
  await device4.waitForTextElementToBePresent(new ConversationItem(device2, testGroupName));
  // Leave Group on device 3
  await device3.clickOnElementAll(new ConversationSettings(device3));
  await device3.clickOnElementAll(new LeaveGroupMenuItem(device3));
  await device3.checkModalStrings(
    tStripped('groupLeave'),
    tStripped('groupLeaveDescription', { group_name: testGroupName })
  );
  await device3.clickOnElementAll(new LeaveGroupConfirm(device3));
  // Check for group not being visible anymore
  await Promise.all(
    [device3, device4].map(device =>
      device.verifyElementNotPresent({
        ...new ConversationItem(device, testGroupName).build(),
        maxWait: 10_000,
      })
    )
  );
  // Create control message for user leaving group
  const groupMemberLeft = tStripped('groupMemberLeft', { name: charlie.userName });
  await Promise.all([
    device1.waitForControlMessageToBePresent(groupMemberLeft),
    device2.waitForControlMessageToBePresent(groupMemberLeft),
  ]);
  await closeApp(device1, device2, device3, device4);
}
