import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { open2AppsLinkedUser } from './state_builder';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Join community test',
  risk: 'high',
  testCb: joinCommunityTest,
  countOfDevicesNeeded: 2,
});

async function joinCommunityTest(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsLinkedUser({ platform });
  const testMessage = `Test message + ${new Date().getTime()}`;

  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await device1.onIOS().scrollToBottom();
  await device1.sendMessage(testMessage);
  // Has community synced to device 2?
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testCommunityName,
  });
  await closeApp(device1, device2);
}
