import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME, type AccessibilityId } from '../../types/testing';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt({
  title: 'Message requests clear all',
  risk: 'medium',
  testCb: clearAllRequests,
  countOfDevicesNeeded: 2,
});

async function clearAllRequests(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [alice, bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Select Clear All button
  await device2.clickOnByAccessibilityID('Clear all');
  await device2.checkModalStrings(
    englishStrippedStr('clearAll').toString(),
    englishStrippedStr('messageRequestsClearAllExplanation').toString(),
    true
  );
  await device2.clickOnByAccessibilityID('Clear');
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = englishStrippedStr('messageRequestsNonePending').toString();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: messageRequestsNonePending as AccessibilityId,
  });
  await closeApp(device1, device2);
}
