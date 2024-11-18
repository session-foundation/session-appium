import { testCommunityLink, testCommunityName } from '../../constants/community';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { joinCommunity } from './utils/join_community';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

iosIt('Send image to community', 'medium', sendImageCommunityiOS);
androidIt('Send image to community', 'medium', sendImageCommunityAndroid);

async function sendImageCommunityiOS(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const testMessage = 'Testing sending images to communities';
  const testImageMessage = `Image message + ${new Date().getTime()}`;
  // Create user A and user B
  const [Alice, Bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  await newContact(platform, device1, Alice, device2, Bob);
  await Promise.all([device1.navigateBack(), device2.navigateBack()]);
  await joinCommunity(device1, testCommunityLink, testCommunityName);
  await joinCommunity(device2, testCommunityLink, testCommunityName);
  await Promise.all([device1.scrollToBottom(platform), device2.scrollToBottom(platform)]);
  await device1.sendMessage(testMessage);
  await device1.sendImage(platform, testImageMessage, true);
  await device2.replyToMessage(Alice, testImageMessage);
  await closeApp(device1, device2);
}

async function sendImageCommunityAndroid(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const time = await device1.getTimeFromDevice(platform);
  const testMessage = `Testing sending images to communities + ${time}`;
  // Create user A and user B
  const [Alice] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  const replyMessage = `Replying to image from ${Alice.userName} in community ${testCommunityName} + ${time}`;
  await Promise.all([
    joinCommunity(device1, testCommunityLink, testCommunityName),
    joinCommunity(device2, testCommunityLink, testCommunityName),
  ]);
  await device1.sendImageWithMessageAndroid(testMessage);
  await device2.scrollToBottom(platform);
  await device2.longPressMessage(testMessage);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.onIOS().scrollToBottom(platform);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });

  await closeApp(device1, device2);
}
