import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open_Alice2_Bob1_friends } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Unsent message syncs',
  risk: 'medium',
  testCb: unSendMessageLinkedDevice,
  countOfDevicesNeeded: 3,
});

async function unSendMessageLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, alice2, bob1 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

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
    text: bob.userName,
  });
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
