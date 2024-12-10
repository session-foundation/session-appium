import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { SupportedPlatformsType, closeApp, openAppTwoDevices } from './utils/open_app';

bothPlatformsIt('Delete message locally', 'high', deleteMessage);

async function deleteMessage(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);

  // Create two users
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);
  // Create contact
  await newContact(platform, device1, userA, device2, userB);
  // send message from User A to User B
  const sentMessage = await device1.sendMessage('Checking local deletetion functionality');
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Select and long press on message to delete it
  await device1.longPressMessage(sentMessage);
  // Select Delete icon
  await device1.clickOnByAccessibilityID('Delete message');
  // There is no modal on iOS yet (to come)
  await device1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );

  // Select 'Delete on this device only'
  await device1.clickOnElementAll(new DeleteMessageLocally(device1));
  // Confirm deletion Android only
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));

  // Device 1 should show 'Deleted message' message
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Deleted message',
  });

  // Device 2 should show no change
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });

  // Excellent
  await closeApp(device1, device2);
}
