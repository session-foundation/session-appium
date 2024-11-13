import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockedContactsSettings, BlockUserConfirmationModal } from './locators';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Block message request', 'high', blockedRequest);

async function blockedRequest(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);

  const userA = await newUser(device1, USERNAME.ALICE, platform);
  const userB = await linkedDevice(device2, device3, USERNAME.BOB, platform);
  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  // Check on linked device for message request
  await device3.clickOnByAccessibilityID('Message requests banner');
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message request',
  });
  // Bob clicks on block option
  await device2.clickOnByAccessibilityID('Block message request');
  // Confirm block on android
  await sleepFor(1000);
  // TODO add check modal
  // await device2.waitForTextElementToBePresent({
  //   strategy: 'accessibility id',
  //   selector: 'Block message request',
  // });
  await device2.clickOnElementAll(new BlockUserConfirmationModal(device1));
  const blockedMessage = `"${userA.userName} to ${userB.userName} - shouldn't get through"`;
  await device1.sendMessage(blockedMessage);
  await device2.navigateBack();
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'New conversation button',
  });
  // Need to wait to see if message gets through
  await sleepFor(5000);
  await device2.hasTextElementBeenDeleted('Message body', blockedMessage);
  // Check that user is on Blocked User list in Settings
  if (platform === 'ios') {
    await device2.clickOnElementAll(new UserSettings(device2));
    await device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' });
    await device2.clickOnElementAll(new BlockedContactsSettings(device2));
    await device2.waitForTextElementToBePresent({
      strategy: 'xpath',
      selector: `//XCUIElementTypeCell[@name="${userA.userName}"]`,
    });
  }
  // Close app
  await closeApp(device1, device2, device3);
}
