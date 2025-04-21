import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { LeaveGroup } from './locators';
import { ConversationSettings } from './locators/conversation';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppFourDevices } from './utils/open_app';

bothPlatformsIt({
  title: 'Leave group linked device',
  risk: 'high',
  testCb: leaveGroupLinkedDevice,
  countOfDevicesNeeded: 4,
});
async function leaveGroupLinkedDevice(platform: SupportedPlatformsType) {
  const testGroupName = 'Leave group linked device';
  const { device1, device2, device3, device4 } = await openAppFourDevices(platform);
  const userC = await linkedDevice(device3, device4, USERNAME.CHARLIE);
  // Create users A, B and C
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Create group with user A, user B and User C
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  await sleepFor(1000);
  await device3.clickOnElementAll(new ConversationSettings(device3));
  await sleepFor(1000);
  await device3.clickOnElementAll(new LeaveGroup(device3));
  await device3.clickOnByAccessibilityID('Leave');
  // Check for control message
  await sleepFor(5000);
  await device4.onIOS().hasTextElementBeenDeleted('Conversation list item', testGroupName);
  // Create control message for user leaving group
  const groupMemberLeft = englishStripped('groupMemberLeft')
    .withArgs({ name: userC.userName })
    .toString();
  await Promise.all([
    device1.waitForControlMessageToBePresent(groupMemberLeft),
    device2.waitForControlMessageToBePresent(groupMemberLeft),
  ]);
  await closeApp(device1, device2, device3, device4);
}
