import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open_Alice2_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Delete message linked device',
  risk: 'high',
  testCb: deletedMessageLinkedDevice,
  countOfDevicesNeeded: 3,
});
async function deletedMessageLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1, alice2 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

  const testMessage = 'Howdy';
  // Send message from user a to user b
  const sentMessage = await alice1.sendMessage(testMessage);
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  await alice2.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Conversation list item',
  });
  await alice2.selectByText('Conversation list item', bob.userName);
  // Find message
  await alice2.findMessageWithBody(sentMessage);
  // Select message on device 1, long press
  await alice1.longPressMessage(sentMessage);
  // Select delete
  await alice1.clickOnByAccessibilityID('Delete message');
  await alice1.checkModalStrings(
    englishStrippedStr('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStrippedStr('deleteMessageConfirm').withArgs({ count: 1 }).toString()
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
