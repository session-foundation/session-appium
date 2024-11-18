import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt('Unsent message syncs', 'medium', unSendMessageLinkedDevice);

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE, platform);
  const userB = await newUser(device2, USERNAME.BOB, platform);
  await newContact(platform, device1, userA, device2, userB);
  // Send message from user a to user b
  const sentMessage = await device1.sendMessage('Howdy');
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  // Need to wait for notifications to disappear
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
  });
  await device3.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userB.userName,
  });
  // Find message
  await device3.findMessageWithBody(sentMessage);
  // Select message on device 1, long press
  await device1.longPressMessage(sentMessage);
  // Select delete
  await device1.clickOnByAccessibilityID('Delete message');
  await device1
    .onAndroid()
    .checkModalStrings(
      englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
      englishStripped('deleteMessageConfirm').toString()
    );
  // Select delete for everyone
  await device1.clickOnElementAll(new DeleteMessageForEveryone(device1));
  await device1.onAndroid().clickOnElementAll(new DeleteMessageConfirmationModal(device1));

  if (platform === 'android') {
    await Promise.all([
      device1.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Deleted message',
        maxWait: 8000,
      }),
      device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Deleted message',
        maxWait: 8000,
      }),
      device3.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Deleted message',
        maxWait: 8000,
      }),
    ]);
  } else {
    await Promise.all([
      device1.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: sentMessage,
      }),
      device2.waitForTextElementToBePresent({
        strategy: 'accessibility id',
        selector: 'Deleted message',
        maxWait: 8000,
      }),
      device3.hasElementBeenDeleted({
        strategy: 'accessibility id',
        selector: 'Message body',
        text: sentMessage,
      }),
    ]);
  }
  // Close app
  await closeApp(device1, device2, device3);
}
