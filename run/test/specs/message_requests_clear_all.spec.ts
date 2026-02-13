import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { type AccessibilityId, USERNAME } from '../../types/testing';
import { MessageRequestsBanner } from '../locators/home';
import { newUser } from '../utils/create_account';
import { closeApp, openAppTwoDevices, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Message requests clear all',
  risk: 'medium',
  testCb: clearAllRequests,
  countOfDevicesNeeded: 2,
});

async function clearAllRequests(platform: SupportedPlatformsType, testInfo: TestInfo) {
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
  // Select Clear All button
  await device2.clickOnByAccessibilityID('Clear all');
  await device2.checkModalStrings(
    tStripped('clearAll'),
    tStripped('messageRequestsClearAllExplanation')
  );
  await device2.clickOnByAccessibilityID('Clear');
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = tStripped('messageRequestsNonePending');
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: messageRequestsNonePending as AccessibilityId,
  });
  await closeApp(device1, device2);
}
