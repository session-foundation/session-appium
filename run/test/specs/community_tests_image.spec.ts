import { testCommunityLink, testCommunityName } from '../../constants/community';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { open2AppsWithFriendsState } from './state_builder';
import { newUser } from './utils/create_account';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Send image to community', 'medium', sendImageCommunityiOS, true);
androidIt('Send image to community', 'medium', sendImageCommunityAndroid, true);

// Tests skipped due to both platforms having unique issues, have made a ticket
// to investigate further https://optf.atlassian.net/browse/QA-486

async function sendImageCommunityiOS(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: false,
  });
  const testMessage = 'Testing sending images to communities';
  const testImageMessage = `Image message + ${new Date().getTime()} - ${platform}`;

  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await joinCommunity(device2, testCommunityLink, testCommunityName);
  await Promise.all([device1.scrollToBottom(), device2.scrollToBottom()]);
  await device1.sendMessage(testMessage);
  await device1.sendImage(platform, testImageMessage, true);
  await device2.replyToMessage(userA, testImageMessage);
  await closeApp(device1, device2);
}

async function sendImageCommunityAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const time = await device1.getTimeFromDevice(platform);
  const testMessage = `Testing sending images to communities + ${time} - ${platform}`;
  // Create user A and user B
  const [Alice] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const replyMessage = `Replying to image from ${Alice.userName} in community ${testCommunityName} + ${time}`;
  await Promise.all([
    joinCommunity(device1, testCommunityLink, testCommunityName),
    joinCommunity(device2, testCommunityLink, testCommunityName),
  ]);
  await device1.sendImageWithMessageAndroid(testMessage);
  await device2.scrollToBottom();
  await device2.longPressMessage(testMessage);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  await closeApp(device1, device2);
}
