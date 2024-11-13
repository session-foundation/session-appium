import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { AccessibilityId, USERNAME } from '../../types/testing';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Message requests clear all', 'medium', clearAllRequests);

async function clearAllRequests(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Select Clear All button
  await device2.clickOnByAccessibilityID('Clear all');
  await sleepFor(1000);
  await device2.clickOnByAccessibilityID('Clear');
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = englishStripped('messageRequestsNonePending').toString();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: messageRequestsNonePending as AccessibilityId,
  });
  await closeApp(device1, device2);
}
