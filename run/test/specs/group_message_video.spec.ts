import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

iosIt('Send video to group', 'medium', sendVideoGroupiOS);
androidIt('Send video to group', 'medium', sendVideoGroupAndroid);

async function sendVideoGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
    newUser(device3, USERNAME.CHARLIE, platform),
  ]);

  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const testMessage = 'Testing-video-1';
  const replyMessage = `Replying to video from ${userA.userName} in ${testGroupName}`;
  await device1.sendVideoiOS(testMessage);
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
  });
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: testMessage,
    maxWait: 5000,
  });
  await device2.longPressMessage(testMessage);
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: replyMessage,
  });
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function sendVideoGroupAndroid(platform: SupportedPlatformsType) {
  // Test sending a video
  // open devices
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
    newUser(device3, USERNAME.CHARLIE, platform),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const replyMessage = `Replying to video from ${userA.userName} in ${testGroupName}`;
  // Click on attachments button
  await device1.sendVideoAndroid();
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  // Check video appears in device 2 and device 3
  // (wait for loading animation to disappear and play icon to appear)
  // Device 2
  await Promise.all([
    device2.waitForLoadingMedia(),
    device2.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Device 3
  await Promise.all([
    device3.waitForLoadingMedia(),
    device3.waitForTextElementToBePresent({
      strategy: 'id',
      selector: 'network.loki.messenger:id/play_overlay',
      maxWait: 8000,
    }),
  ]);
  // Reply to message on device 2
  await device2.longPress('Media message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  // Check reply appears in device 1 and device 3
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: replyMessage,
    }),
  ]);
  // Close app and server
  await closeApp(device1, device2, device3);
}
