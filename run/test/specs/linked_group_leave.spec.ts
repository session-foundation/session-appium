import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupConfirm, LeaveGroupMenuItem } from './locators/groups';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppFourDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Leave group linked device',
  risk: 'high',
  testCb: leaveGroupLinkedDevice,
  countOfDevicesNeeded: 4,
});

async function leaveGroupLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Leave group linked device';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform, testInfo);
  const charlie = await linkedDevice(device3, device4, USERNAME.CHARLIE);
  // Create users A, B and C
  const [alice, bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Create group with user A, user B and User C
  await createGroup(platform, device1, alice, device2, bob, device3, charlie, testGroupName);
  await sleepFor(1000);
  await device3.clickOnElementAll(new ConversationSettings(device3));
  await sleepFor(1000);
  await device3.clickOnElementAll(new LeaveGroupMenuItem(device3));
  await device3.checkModalStrings(
    englishStrippedStr('groupLeave').toString(),
    englishStrippedStr('groupLeaveDescription').withArgs({ group_name: testGroupName }).toString()
  );
  // Modal with Leave/Cancel
  await device3.clickOnElementAll(new LeaveGroupConfirm(device3));
  // Check for control message
  await sleepFor(5000);
  await device4.onIOS().hasTextElementBeenDeleted('Conversation list item', testGroupName);
  // Create control message for user leaving group
  const groupMemberLeft = englishStrippedStr('groupMemberLeft')
    .withArgs({ name: charlie.userName })
    .toString();
  await Promise.all([
    device1.waitForControlMessageToBePresent(groupMemberLeft),
    device2.waitForControlMessageToBePresent(groupMemberLeft),
  ]);
  await closeApp(device1, device2, device3, device4);
}
