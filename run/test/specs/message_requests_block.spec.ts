import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME, type AccessibilityId } from '../../types/testing';
import { BlockedContactsSettings, BlockUserConfirmationModal } from './locators';
import { UserSettings } from './locators/settings';
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

async function blockedRequest(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);

  const alice = await newUser(device1, USERNAME.ALICE);
  const bob = await linkedDevice(device2, device3, USERNAME.BOB);
  // Send message from Alice to Bob
  await device1.sendNewMessage(bob, `${alice.userName} to ${bob.userName}`);
  // Wait for banner to appear on device 2 and 3
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message requests banner',
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message requests banner',
    }),
  ]);
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  // Bob clicks on block option
  await device2.clickOnByAccessibilityID('Block message request');
  // Confirm block on android
  await sleepFor(1000);
  // TODO add check modal
  await device2.checkModalStrings(
    englishStrippedStr('block').toString(),
    englishStrippedStr('blockDescription').withArgs({ name: alice.userName }).toString(),
    true
  );
  await device2.clickOnElementAll(new BlockUserConfirmationModal(device1));
  // "messageRequestsNonePending": "No pending message requests",
  const messageRequestsNonePending = englishStrippedStr('messageRequestsNonePending').toString();
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: messageRequestsNonePending as AccessibilityId,
    }),
    device3.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Message requests banner',
    }),
  ]);
  const blockedMessage = `"${alice.userName} to ${bob.userName} - shouldn't get through"`;
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

  await Promise.all([
    device2.clickOnElementAll(new UserSettings(device2)),
    device3.clickOnElementAll(new UserSettings(device3)),
  ]);
  await Promise.all([
    device2.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' }),
    device3.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' }),
  ]);
  await Promise.all([
    device2.clickOnElementAll(new BlockedContactsSettings(device2)),
    device3.clickOnElementAll(new BlockedContactsSettings(device3)),
  ]);
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Contact',
      text: alice.userName,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Contact',
      text: alice.userName,
    }),
  ]);
  // Close app
  await closeApp(device1, device2, device3);
}
