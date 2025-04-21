import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsend message',
  risk: 'high',
  testCb: unsendMessage,
  countOfDevicesNeeded: 2,
});

async function unsendMessage(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
  } = await open2AppsWithFriendsState({
    platform,
  });
  const testMessage = 'Checking unsend functionality';

  // send message from User A to User B
  const sentMessage = await device1.sendMessage(testMessage);
  // await sleepFor(1000);
  await device2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  await device1.longPressMessage(sentMessage);
  // Select Delete icon
  await device1.clickOnByAccessibilityID('Delete message');
  // Check modal is correct
  // Check modal is correct
  await device1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete for me and User B'
  await device1.clickOnElementAll(new DeleteMessageForEveryone(device1));
  // Select 'Delete' on Android
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));
  // Check for 'deleted message' message
  await Promise.all([
    device1.waitForTextElementToBePresent({
      ...new DeletedMessage(device1).build(),
      maxWait: 8000,
    }),
    device2.waitForTextElementToBePresent({
      ...new DeletedMessage(device2).build(),
      maxWait: 8000,
    }),
  ]);
  // Excellent
  await closeApp(device1, device2);
}
