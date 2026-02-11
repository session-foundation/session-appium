import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { type AccessibilityId, USERNAME } from '../../types/testing';
import { BlockedContactsSettings } from './locators';
import { Contact } from './locators/global';
import { MessageRequestItem, MessageRequestsBanner, PlusButton } from './locators/home';
import { ConversationsMenuItem, UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Block message request in conversation',
  risk: 'high',
  testCb: blockedRequest,
  countOfDevicesNeeded: 3,
});

async function blockedRequest(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform, testInfo);

  const alice = await newUser(device1, USERNAME.ALICE);
  const bob = await linkedDevice(device2, device3, USERNAME.BOB);
  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  // Wait for banner to appear on device 2 and 3
  await Promise.all(
    [device2, device3].map(device =>
      device.waitForTextElementToBePresent(new MessageRequestsBanner(device))
    )
  );
  // Bob clicks on message request banner
  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  // Bob clicks on request conversation item
  await device2.clickOnElementAll(new MessageRequestItem(device2));
  // Bob clicks on block option
  await device2.clickOnByAccessibilityID('Block message request');
  // Confirm block on android
  await sleepFor(1000);
  await device2.checkModalStrings(
    tStripped('block'),
    tStripped('blockDescription', { name: alice.userName })
  );
  await device2.clickOnByAccessibilityID('Block'); // This is an old Android modal so can't use the modern locator class
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = tStripped('messageRequestsNonePending');
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: messageRequestsNonePending as AccessibilityId,
    }),
    device3.verifyElementNotPresent({
      ...new MessageRequestsBanner(device3).build(),
      maxWait: 5_000,
    }),
  ]);
  const blockedMessage = `"${alice.userName} to ${bob.userName} - shouldn't get through"`;
  await device1.sendMessage(blockedMessage);
  await device2.navigateBack(false);
  await device2.waitForTextElementToBePresent(new PlusButton(device2));
  // Need to wait to see if message gets through
  await sleepFor(5000);
  await device2.hasTextElementBeenDeleted('Message body', blockedMessage);
  // Check that user is on Blocked User list in Settings
  await Promise.all(
    [device2, device3].map(async device => {
      await device.clickOnElementAll(new UserSettings(device));
      await device.clickOnElementAll(new ConversationsMenuItem(device));
      await device.clickOnElementAll(new BlockedContactsSettings(device));
      await device.waitForTextElementToBePresent(new Contact(device, alice.userName));
    })
  );
  // Close app
  await closeApp(device1, device2, device3);
}
