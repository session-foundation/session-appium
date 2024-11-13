import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

iosIt('Delete message in group', 'high', deleteMessageGroupiOS);
androidIt('Delete message in group', 'high', deleteMessageGroupAndroid);

async function deleteMessageGroupiOS(platform: SupportedPlatformsType) {
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
  const sentMessage = await device1.sendMessage('Checking delete functionality');
  // await sleepFor(1000);
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Select and long press on message to delete it
  await device1.longPressMessage(sentMessage);
  // Select Delete icon
  await device1.clickOnByAccessibilityID('Delete message');
  // Select 'Delete for everyone'
  await device1.clickOnByAccessibilityID('Delete for me');
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Excellentgit
  await closeApp(device1, device2, device3);
}

async function deleteMessageGroupAndroid(platform: SupportedPlatformsType) {
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
  const sentMessage = await device1.sendMessage('Checking unsend functionality');
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Select and long press on message to delete it
  await device1.longPressMessage(sentMessage);
  // Select Delete icon
  await device1.clickOnByAccessibilityID('Delete message');
  // Select 'Delete for everyone'
  await device1.clickOnByAccessibilityID('Delete just for me');
  await device1.hasElementBeenDeleted({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
    maxWait: 5000,
  });
  // Excellent
  await closeApp(device1, device2, device3);
}
