import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open3Apps2Friends2LinkedFirstUser } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message linked device',
  risk: 'high',
  testCb: deletedMessageLinkedDevice,
  countOfDevicesNeeded: 3,
});
async function deletedMessageLinkedDevice(platform: SupportedPlatformsType) {
  const {
    devices: { device1: alice1, device2: bob1, device3: alice2 },
    prebuilt: { userB },
  } = await open3Apps2Friends2LinkedFirstUser({ platform, focusFriendsConvo: true });

  const testMessage = 'Howdy';
  // Send message from user a to user b
  const sentMessage = await alice1.sendMessage(testMessage);
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
  });
  await alice2.selectByText('Conversation list item', userB.userName);
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
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  // Check linked device for deleted message
  await alice1.waitForTextElementToBePresent(new DeletedMessage(alice1));
  // Check device 2 and 3 for no change
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
    alice2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
  ]);
  // Close app
  await closeApp(alice1, bob1, alice2);
}
