import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { ConversationSettings } from './locators/conversation';
import { LeaveGroupButton } from './locators/groups';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
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
    devices: { alice1, bob1, charlie1 },
    prebuilt: { charlie },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
  });
  await charlie1.clickOnElementAll(new ConversationSettings(charlie1));
  await sleepFor(1000);
  await charlie1.clickOnElementAll(new LeaveGroupButton(charlie1));
  // Modal with Leave/Cancel
  await charlie1.clickOnByAccessibilityID('Leave');
  // Check for control message
  const groupMemberLeft = englishStripped('groupMemberLeft')
    .withArgs({ name: charlie.userName })
    .toString();
  await alice1.waitForControlMessageToBePresent(groupMemberLeft);
  await bob1.waitForControlMessageToBePresent(groupMemberLeft);
  // Check device 3 that group has disappeared
  await charlie1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testGroupName,
  });
  await closeApp(alice1, bob1, charlie1);
}
