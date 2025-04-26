import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsend message',
  risk: 'high',
  testCb: unsendMessage,
  countOfDevicesNeeded: 2,
});

async function unsendMessage(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const testMessage = 'Checking unsend functionality';

  // send message from User A to User B
  const sentMessage = await alice1.sendMessage(testMessage);
  // await sleepFor(1000);
  await bob1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: sentMessage,
  });
  await alice1.longPressMessage(sentMessage);
  // Select Delete icon
  await alice1.clickOnByAccessibilityID('Delete message');
  // Check modal is correct
  // Check modal is correct
  await alice1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete for me and User B'
  await alice1.clickOnElementAll(new DeleteMessageForEveryone(alice1));
  // Select 'Delete' on Android
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  // Check for 'deleted message' message
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      ...new DeletedMessage(alice1).build(),
      maxWait: 8000,
    }),
    bob1.waitForTextElementToBePresent({
      ...new DeletedMessage(bob1).build(),
      maxWait: 8000,
    }),
  ]);
  // Excellent
  await closeApp(alice1, bob1);
}
