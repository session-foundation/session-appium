import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { MessageRequestsBanner } from './locators/home';
import { newUser } from './utils/create_account';
import { retryMsgSentForBanner } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';
import { runOnlyOnIOS } from './utils/run_on';
import { sleepFor } from './utils/sleep_for';

bothPlatformsIt({
  title: 'Create contact',
  risk: 'high',
  testCb: createContact,
  countOfDevicesNeeded: 3,
});

async function createContact(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform, testInfo);
  const Alice = await linkedDevice(device1, device3, USERNAME.ALICE);
  const Bob = await newUser(device2, USERNAME.BOB);

  // await newContact(platform, device1, userA, device2, Bob);
  await device1.sendNewMessage(Bob, `${Alice.userName} to ${Bob.userName}`);
  // Click on message request folder
  await sleepFor(100);
  await runOnlyOnIOS(platform, () => retryMsgSentForBanner(platform, device1, device2, 30000)); // this runOnlyOnIOS is needed

  await device2.clickOnElementAll(new MessageRequestsBanner(device2));
  await device2.clickOnByAccessibilityID('Message request');
  await device2.clickOnByAccessibilityID('Accept message request');

  // Type into message input box
  await device2.sendMessage(`Reply-message-${Bob.userName}-to-${Alice.userName}`);
  // NOTE: This appears to be broken on both platforms:
  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  // const messageRequestsAccepted = englishStrippedStr('messageRequestsAccepted').toString();
  // await device1.waitForTextElementToBePresent({
  //   strategy: 'accessibility id',
  //   selector: 'Control message',
  //   text: messageRequestsAccepted,
  // });

  console.info(`${Alice.userName} and ${Bob.userName} are now contacts`);
  await device1.navigateBack();
  await device2.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
    }),
  ]);
  // Check contact is added to contacts list on device 1 and 3 (linked device)
  // await Promise.all([
  //   device1.clickOnElementAll({
  //     strategy: "accessibility id",
  //     selector: "New conversation button",
  //   }),
  //   device3.clickOnElementAll({
  //     strategy: "accessibility id",
  //     selector: "New conversation button",
  //   }),
  // ]);

  // NEED CONTACT ACCESSIBILITY ID TO BE ADDED
  // await Promise.all([
  //   device1.waitForTextElementToBePresent({
  //     strategy: "accessibility id",
  //     selector: "Contacts",
  //   }),
  //   device3.waitForTextElementToBePresent({
  //     strategy: "accessibility id",
  //     selector: "Contacts",
  //   }),
  // ]);

  // Wait for tick
  await closeApp(device1, device2, device3);
}
