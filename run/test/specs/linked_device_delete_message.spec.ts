import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal } from '../locators';
import { DeletedMessage, MessageBody } from '../locators/conversation';
import { ConversationItem } from '../locators/home';
import { open_Alice2_Bob1_friends } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Delete message linked device',
  risk: 'high',
  testCb: deletedMessageLinkedDevice,
  countOfDevicesNeeded: 3,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Message',
  },
  allureDescription:
    'Verifies that when a message is deleted on one device, it shows as deleted on a linked device too.',
});
async function deletedMessageLinkedDevice(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1, alice2 },
    prebuilt: { bob },
  } = await open_Alice2_Bob1_friends({ platform, focusFriendsConvo: true, testInfo });

  const testMessage = 'Howdy';
  // Send message from user a to user b
  await alice1.sendMessage(testMessage);
  // Check message came through on linked device(3)
  // Enter conversation with user B on device 3
  await alice2.clickOnElementAll(new ConversationItem(alice2, bob.userName)); // Find message
  await alice2.findMessageWithBody(testMessage);
  // Select message on device 1, long press
  await alice1.longPressMessage(new MessageBody(alice1, testMessage));
  // Select delete
  await alice1.clickOnByAccessibilityID('Delete message');
  await alice1.checkModalStrings(
    tStripped('deleteMessage', { count: 1 }),
    tStripped('deleteMessageConfirm', { count: 1 })
  );
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  // Check linked device for deleted message
  await alice1.waitForTextElementToBePresent(new DeletedMessage(alice1));
  // Check device 2 and 3 for no change
  await Promise.all(
    [bob1, alice2].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, testMessage))
    )
  );
  // Close app
  await closeApp(alice1, bob1, alice2);
}
