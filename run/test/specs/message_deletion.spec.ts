import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message locally',
  risk: 'high',
  testCb: deleteMessage,
  countOfDevicesNeeded: 2,
});
async function deleteMessage(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
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
  await device1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete on this device only'
  await device1.clickOnElementAll(new DeleteMessageLocally(device1));
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));

  // Device 1 should show 'Deleted message' message
  await device1.waitForTextElementToBePresent(new DeletedMessage(device1));

  // Device 2 should show no change
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });

  // Excellent
  await closeApp(device1, device2);
}
