import type { TestInfo } from '@playwright/test';

import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { ConversationItem } from './locators/home';
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

  await device2.acceptMessageRequestWithButton();

  // Type into message input box
  await device2.sendMessage(`Reply-message-${Bob.userName}-to-${Alice.userName}`);
  // NOTE: This appears to be broken on both platforms:
  // Verify config message states message request was accepted
  // "messageRequestsAccepted": "Your message request has been accepted.",
  // const messageRequestsAccepted = tStripped('messageRequestsAccepted');
  // await device1.waitForTextElementToBePresent({
  //   strategy: 'accessibility id',
  //   selector: 'Control message',
  //   text: messageRequestsAccepted,
  // });

  console.info(`${Alice.userName} and ${Bob.userName} are now contacts`);
  await device1.navigateBack();
  await device2.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all(
    [device1, device3].map(device =>
      device.waitForTextElementToBePresent(new ConversationItem(device, Bob.userName))
    )
  );

  await closeApp(device1, device2, device3);
}
