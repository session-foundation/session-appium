import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME, type AccessibilityId } from '../../types/testing';
import { DeleteMessageRequestButton, DeleteMesssageRequestConfirmation } from './locators';
import { newUser } from './utils/create_account';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Delete message request in list', 'high', deleteRequest);

async function deleteRequest(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Swipe left on ios
  await device2.onIOS().swipeLeftAny('Message request');
  await device2.onAndroid().longPress('Message request');
  await device2.clickOnElementAll(new DeleteMessageRequestButton(device2));
  await device2.checkModalStrings(
    englishStripped('delete').toString(),
    englishStripped('messageRequestsDelete').toString(),
    true
  );
  await device2.clickOnElementAll(new DeleteMesssageRequestConfirmation(device2));
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = englishStripped('messageRequestsNonePending').toString();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: messageRequestsNonePending as AccessibilityId,
  });

  await closeApp(device1, device2);
}
