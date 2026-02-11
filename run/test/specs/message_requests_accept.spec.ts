import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationItem } from './locators/home';
import { newUser } from './utils/create_account';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Accept message request',
  risk: 'high',
  testCb: acceptRequest,
  countOfDevicesNeeded: 3,
});

async function acceptRequest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Check 'accept' button
  // Open app
  const { device1, device2, device3 } = await openAppThreeDevices(platform, testInfo);
  // Create two users
  const alice = await newUser(device1, USERNAME.ALICE);
  const bob = await linkedDevice(device2, device3, USERNAME.BOB);

  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  await device2.acceptMessageRequestWithButton();
  // Check control message for message request acceptance
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = tStripped('messageRequestsAccepted');
  const messageRequestYouHaveAccepted = tStripped('messageRequestYouHaveAccepted', {
    name: alice.userName,
  });
  await Promise.all([
    device1.waitForControlMessageToBePresent(messageRequestsAccepted),
    device2.waitForControlMessageToBePresent(messageRequestYouHaveAccepted),
  ]);
  // Check conversation list for new contact (user A)
  await device2.navigateBack();
  await device2.onAndroid().navigateBack(false);
  await Promise.all(
    [device2, device3].map(device =>
      device.waitForTextElementToBePresent(new ConversationItem(device, alice.userName))
    )
  );
  // Close app
  await closeApp(device1, device2, device3);
}
