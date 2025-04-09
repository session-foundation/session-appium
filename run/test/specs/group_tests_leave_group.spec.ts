import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupButton } from './locators/groups';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt('Leave group', 'high', leaveGroup);

async function leaveGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Leave group';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);

  // Create group with user A, user B and User C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await device3.clickOnElementAll(new ConversationSettings(device3));
  await sleepFor(1000);
  await device3.clickOnElementAll(new LeaveGroupButton(device3));
  // Modal with Leave/Cancel
  await device3.clickOnByAccessibilityID('Leave');
  // Check for control message
  const groupMemberLeft = englishStripped('groupMemberLeft')
    .withArgs({ name: userC.userName })
    .toString();
  await device1.waitForControlMessageToBePresent(groupMemberLeft);
  await device2.waitForControlMessageToBePresent(groupMemberLeft);
  // Check device 3 that group has disappeared
  await device3.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testGroupName,
  });
  await closeApp(device1, device2, device3);
}
