import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { type AccessibilityId, USERNAME } from '../../types/testing';
import { DeclineMessageRequestButton, DeleteMesssageRequestConfirmation } from './locators';
import { MessageRequestItem, MessageRequestsBanner, PlusButton } from './locators/home';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message request in conversation',
  risk: 'high',
  testCb: declineRequest,
  countOfDevicesNeeded: 3,
});

async function declineRequest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  // Check 'decline' button
  const { device1, device2, device3 } = await openAppThreeDevices(platform, testInfo);
  // Create two users
  const alice = await newUser(device1, USERNAME.ALICE);
  const bob = await linkedDevice(device2, device3, USERNAME.BOB);
  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  // Check message request appears on linked device (device 3)
  await device3.clickOnElementAll(new MessageRequestsBanner(device3));
  await device3.waitForTextElementToBePresent(new MessageRequestItem(device3));
  // Click on decline button
  await device2.clickOnElementAll(new DeclineMessageRequestButton(device2));
  await device2.checkModalStrings(tStripped('delete'), tStripped('messageRequestsContactDelete'));
  await device2.clickOnElementAll(new DeleteMesssageRequestConfirmation(device2));
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = tStripped('messageRequestsNonePending');
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: messageRequestsNonePending as AccessibilityId,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: messageRequestsNonePending as AccessibilityId,
    }),
  ]);
  // Navigate back to home page
  await sleepFor(100);
  await device2.navigateBack(false);
  // Look for new conversation button to make sure it all worked
  await device2.waitForTextElementToBePresent(new PlusButton(device2));
  // Close app
  await closeApp(device1, device2, device3);
}
