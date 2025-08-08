import type { TestInfo } from '@playwright/test';

import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { type AccessibilityId, USERNAME } from '../../types/testing';
import { DeleteMessageRequestButton, DeleteMesssageRequestConfirmation } from './locators';
import { MessageRequestsBanner } from './locators/home';
import { newUser } from './utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message request in list',
  risk: 'high',
  testCb: deleteRequest,
  countOfDevicesNeeded: 2,
});

async function deleteRequest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2 } = await openAppTwoDevices(platform, testInfo);
  const [alice, bob] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  // Swipe left on ios
  await device2.onIOS().swipeLeftAny('Message request');
  await device2.onAndroid().longPress('Message request');
  await device2.clickOnElementAll(new DeleteMessageRequestButton(device2));
  // TODO remove onIOS/onAndroid once SES-3846 has been completed
  await device2
    .onIOS()
    .checkModalStrings(
      englishStrippedStr('delete').toString(),
      englishStrippedStr('messageRequestsDelete').toString()
    );
  await device2
    .onAndroid()
    .checkModalStrings(
      englishStrippedStr('delete').toString(),
      englishStrippedStr('messageRequestsContactDelete').toString(),
      false
    );
  await device2.clickOnElementAll(new DeleteMesssageRequestConfirmation(device2));
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = englishStrippedStr('messageRequestsNonePending').toString();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: messageRequestsNonePending as AccessibilityId,
  });

  await closeApp(device1, device2);
}
