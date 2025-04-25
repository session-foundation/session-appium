import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open3Apps2Friends2LinkedFirstUser } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsent message syncs',
  risk: 'medium',
  testCb: unSendMessageLinkedDevice,
  countOfDevicesNeeded: 3,
});

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType) {
  const {
    devices: { device1: alice1, device2: alice2, device3: bob1 },
    prebuilt: { userB },
  } = await open3Apps2Friends2LinkedFirstUser({ platform, focusFriendsConvo: true });

  // Send message from user a to user b
  const sentMessage = await alice1.sendMessage('Howdy');
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
  });
  await alice2.clickOnElementAll({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
    text: userB.userName,
  });
  // Find message
  await alice2.findMessageWithBody(sentMessage);
  // Select message on device 1, long press
  await alice1.longPressMessage(sentMessage);
  // Select delete
  await alice1.clickOnByAccessibilityID('Delete message');
  await alice1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select delete for everyone
  await alice1.clickOnElementAll(new DeleteMessageForEveryone(alice1));
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  await Promise.all(
    [alice1, bob1, alice2].map(device =>
      device.waitForTextElementToBePresent({
        ...new DeletedMessage(device).build(),
        maxWait: 5000,
      })
    )
  );
  // Close app
  await closeApp(alice1, bob1, alice2);
}
