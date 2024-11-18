import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { joinCommunity } from './utils/join_community';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Join community test', 'high', joinCommunityTest);

async function joinCommunityTest(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testMessage = `Test message + ${new Date().getTime()}`;
  // Create user A and user B
  await linkedDevice(device1, device2, USERNAME.ALICE, platform);
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.onIOS().scrollToBottom(platform);
  await device1.sendMessage(testMessage);
  // Has community synced to device 2?
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testCommunityName,
  });
  await closeApp(device1, device2);
}
