import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

iosIt('Send voice message to group', 'high', sendVoiceMessageGroupiOS);
androidIt('Send voice message to group', 'high', sendVoiceMessageGroupAndroid);

async function sendVoiceMessageGroupiOS(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const replyMessage = `Replying to voice message from ${userA.userName} in ${testGroupName}`;
  await device1.sendVoiceMessage();
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  await device2.longPress('Voice message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  await Promise.all(
    [device1, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  // Close server and devices
  await closeApp(device1, device2, device3);
}

async function sendVoiceMessageGroupAndroid(platform: SupportedPlatformsType) {
  // open devices
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const replyMessage = `Replying to voice message from ${userA.userName} in ${testGroupName}`;
  // Select voice message button to activate recording state
  await device1.sendVoiceMessage();
  await Promise.all([
    device2.trustAttachments(testGroupName),
    device3.trustAttachments(testGroupName),
  ]);
  // Check device 2 and 3 for voice message from user A
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Voice message',
      })
    )
  );
  // Reply to voice message
  await device2.longPress('Voice message');
  await device2.clickOnByAccessibilityID('Reply to message');
  await device2.sendMessage(replyMessage);
  // Check device 1 and 3 for reply to appear
  await Promise.all(
    [device1, device3].map(device =>
      device.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: replyMessage,
      })
    )
  );
  await closeApp(device1, device2, device3);
}
