import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message locally',
  risk: 'high',
  testCb: deleteMessage,
  countOfDevicesNeeded: 2,
});
async function deleteMessage(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  // send message from User A to User B
  const sentMessage = await alice1.sendMessage('Checking local deletetion functionality');
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  // Select and long press on message to delete it
  await alice1.longPressMessage(sentMessage);
  // Select Delete icon
  await alice1.clickOnByAccessibilityID('Delete message');
  await alice1.checkModalStrings(
    englishStrippedStr('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStrippedStr('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete on this device only'
  await alice1.clickOnElementAll(new DeleteMessageLocally(alice1)); // This is currently missing an AX ID on Android
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));

  // Device 1 should show 'Deleted message' message
  await alice1.waitForTextElementToBePresent(new DeletedMessage(alice1));

  // Device 2 should show no change
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });

  // Excellent
  await closeApp(alice1, bob1);
}
