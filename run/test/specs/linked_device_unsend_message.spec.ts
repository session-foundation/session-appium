import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsent message syncs',
  risk: 'medium',
  testCb: unSendMessageLinkedDevice,
  countOfDevicesNeeded: 3,
});

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE);
  const userB = await newUser(device2, USERNAME.BOB);
  await newContact(platform, device1, userA, device2, userB);
  // Send message from user a to user b
  const sentMessage = await device1.sendMessage('Howdy');
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
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
  await device1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select delete for everyone
  await device1.clickOnElementAll(new DeleteMessageForEveryone(device1));
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));
  await Promise.all(
    [device1, device2, device3].map(device =>
      device.waitForTextElementToBePresent({
        ...new DeletedMessage(device).build(),
        maxWait: 5000,
      })
    )
  );
  // Close app
  await closeApp(device1, device2, device3);
}
