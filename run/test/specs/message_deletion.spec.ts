import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from '../locators';
import { DeletedMessage, MessageBody } from '../locators/conversation';
import { open_Alice1_Bob1_friends } from '../state_builder';
import { closeApp, SupportedPlatformsType } from '../utils/open_app';

bothPlatformsIt({
  title: 'Delete message locally',
  risk: 'high',
  testCb: deleteMessage,
  countOfDevicesNeeded: 2,
});
async function deleteMessage(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const {
    devices: { alice1, bob1 },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
    testInfo,
  });
  // send message from User A to User B
  const sentMessage = 'Checking local deletetion functionality';
  await alice1.sendMessage(sentMessage);
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, sentMessage));
  // Select and long press on message to delete it
  await alice1.longPressMessage(new MessageBody(alice1, sentMessage));
  // Select Delete icon
  await alice1.clickOnByAccessibilityID('Delete message');
  await alice1.checkModalStrings(
    tStripped('deleteMessage', { count: 1 }),
    tStripped('deleteMessageConfirm', { count: 1 })
  );
  // Select 'Delete on this device only'
  await alice1.clickOnElementAll(new DeleteMessageLocally(alice1));
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));

  // Device 1 should show 'Deleted message' message
  await alice1.waitForTextElementToBePresent(new DeletedMessage(alice1));

  // Device 2 should show no change
  await bob1.waitForTextElementToBePresent(new MessageBody(bob1, sentMessage));

  // Excellent
  await closeApp(alice1, bob1);
}
