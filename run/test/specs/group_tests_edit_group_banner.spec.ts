import { bothPlatformsIt } from '../../types/sessionIt';
import { closeApp, SupportedPlatformsType } from './utils/open_app';
import { ConversationSettings } from './locators/conversation';
import { EditGroup } from './locators';
import { LatestReleaseBanner } from './locators/groups';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';

bothPlatformsIt({
  title: 'Edit group banner',
  risk: 'medium',
  testCb: editGroupBanner,
  countOfDevicesNeeded: 3,
});

async function editGroupBanner(platform: SupportedPlatformsType) {
  const testGroupName = 'Test group';

  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  // Navigate to Edit Group screen
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new EditGroup(device1));
  const groupsBanner = await device1.doesElementExist(new LatestReleaseBanner(device1));
  if (!groupsBanner) {
    throw new Error('v2 groups warning banner is not shown or text is incorrect');
  }
  await closeApp(device1, device2, device3);
}
