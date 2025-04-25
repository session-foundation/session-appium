import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupButton } from './locators/groups';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { sleepFor } from './utils/index';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Leave group',
  risk: 'high',
  testCb: leaveGroup,
  countOfDevicesNeeded: 3,
});

async function leaveGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Leave group';

  const {
    devices: { device1, device2, device3 },
    prebuilt: { userC },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
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
