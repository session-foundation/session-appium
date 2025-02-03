import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt('Delete message linked device', 'high', deletedMessageLinkedDevice);

async function deletedMessageLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE);
  const userB = await newUser(device2, USERNAME.BOB);
  const testMessage = 'Howdy';
  await newContact(platform, device1, userA, device2, userB);
  // Send message from user a to user b
  const sentMessage = await device1.sendMessage(testMessage);
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  await device3.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
  });
  await device3.selectByText('Conversation list item', userB.userName);
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
      englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
    );

  // Select delete for everyone
  await device1.clickOnElementAll(new DeleteMessageLocally(device1));
  // Confirm deletion Android only
  await device1.onAndroid().clickOnElementAll(new DeleteMessageConfirmationModal(device1));

  // Check linked device for deleted message
  await device1.onIOS().hasTextElementBeenDeleted('Message body', sentMessage);

  await device1.onAndroid().waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Deleted message',
  });

  // Check device 2 and 3 for no change
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
  ]);
  // Close app
  await closeApp(device1, device2, device3);
}
