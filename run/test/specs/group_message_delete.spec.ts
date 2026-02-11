import type { TestInfo } from '@playwright/test';

import { tStripped } from '../../localizer/lib';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { DeletedMessage, MessageBody } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { closeApp, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete message locally in group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: deleteMessageGroup,
  allureSuites: {
    parent: 'User Actions',
    suite: 'Delete Message',
  },
  allureDescription:
    'Verifies that local deletion in a group does not delete a message for other participants.',
});

async function deleteMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';
  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const sentMessage = 'Checking local delete functionality';
  await alice1.sendMessage(sentMessage);
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, sentMessage))
    )
  );
  // Select and long press on message to delete it
  await alice1.longPressMessage(new MessageBody(alice1, sentMessage));
  // Select Delete icon
  await alice1.clickOnByAccessibilityID('Delete message');
  // Check modal is correct
  await alice1.checkModalStrings(
    tStripped('deleteMessage', { count: 1 }),
    tStripped('deleteMessageConfirm', { count: 1 })
  );
  // Select 'Delete for me'
  await alice1.clickOnElementAll(new DeleteMessageLocally(alice1));
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  await alice1.waitForTextElementToBePresent(new DeletedMessage(alice1));
  // Excellent
  // Check device 2 and 3 that message is still visible
  await Promise.all(
    [bob1, charlie1].map(device =>
      device.waitForTextElementToBePresent(new MessageBody(device, sentMessage))
    )
  );
  await closeApp(alice1, bob1, charlie1);
}
