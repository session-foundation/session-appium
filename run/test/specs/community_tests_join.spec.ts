import { testCommunityLink, testCommunityName } from '../../constants/community';
import { bothPlatformsIt } from '../../types/sessionIt';
import { open_Alice2 } from './state_builder';
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
    devices: { alice1, alice2 },
  } = await open_Alice2({ platform });
  const testMessage = `Test message + ${new Date().getTime()}`;

  await joinCommunity(alice1, testCommunityLink, testCommunityName);
  await alice1.onIOS().scrollToBottom();
  await alice1.sendMessage(testMessage);
  // Has community synced to device 2?
  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: testCommunityName,
  });
  await closeApp(alice1, alice2);
}
