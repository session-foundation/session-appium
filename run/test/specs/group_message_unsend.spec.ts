import { englishStrippedStr } from '../../localizer/englishStrippedStr';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open_Alice1_Bob1_Charlie1_friends_group } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';
import type { TestInfo } from '@playwright/test';

bothPlatformsIt({
  title: 'Unsend message in group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: unsendMessageGroup,
});

async function unsendMessageGroup(platform: SupportedPlatformsType, testInfo: TestInfo) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { alice1, bob1, charlie1 },
  } = await open_Alice1_Bob1_Charlie1_friends_group({
    platform,
    groupName: testGroupName,
    focusGroupConvo: true,
    testInfo,
  });
  const sentMessage = await alice1.sendMessage('Checking unsend functionality');
  await Promise.all([
    bob1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
    charlie1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
  ]);
  // Select and long press on message to delete it
  await alice1.longPressMessage(sentMessage);
  // Select Delete icon
  await alice1.clickOnByAccessibilityID('Delete message');
  // Check modal is correct
  await alice1.checkModalStrings(
    englishStrippedStr('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStrippedStr('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete for me'
  await alice1.clickOnElementAll(new DeleteMessageForEveryone(alice1));
  await alice1.clickOnElementAll(new DeleteMessageConfirmationModal(alice1));
  await Promise.all([
    alice1.waitForTextElementToBePresent(new DeletedMessage(alice1)),
    bob1.waitForTextElementToBePresent(new DeletedMessage(bob1)),
    charlie1.waitForTextElementToBePresent(new DeletedMessage(charlie1)),
  ]);
  // Excellent
  await closeApp(alice1, bob1, charlie1);
}
