import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { DeleteMessageConfirmationModal, DeleteMessageForEveryone } from './locators';
import { DeletedMessage } from './locators/conversation';
import { open3AppsWith3FriendsAnd1GroupState } from './state_builder';
import { SupportedPlatformsType, closeApp } from './utils/open_app';

bothPlatformsIt({
  title: 'Unsend message in group',
  risk: 'high',
  countOfDevicesNeeded: 3,
  testCb: unsendMessageGroup,
});

async function unsendMessageGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';

  const {
    devices: { device1, device2, device3 },
  } = await open3AppsWith3FriendsAnd1GroupState({
    platform,
    groupName: testGroupName,
  });
  const sentMessage = await device1.sendMessage('Checking unsend functionality');
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Message body',
      text: sentMessage,
    }),
  ]);
  // Select and long press on message to delete it
  await device1.longPressMessage(sentMessage);
  // Select Delete icon
  await device1.clickOnByAccessibilityID('Delete message');
  // Check modal is correct
  await device1.checkModalStrings(
    englishStripped('deleteMessage').withArgs({ count: 1 }).toString(),
    englishStripped('deleteMessageConfirm').withArgs({ count: 1 }).toString()
  );
  // Select 'Delete for me'
  await device1.clickOnElementAll(new DeleteMessageForEveryone(device1));
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));
  await Promise.all([
    device1.waitForTextElementToBePresent(new DeletedMessage(device1)),
    device2.waitForTextElementToBePresent(new DeletedMessage(device2)),
    device3.waitForTextElementToBePresent(new DeletedMessage(device3)),
  ]);
  // Excellent
  await closeApp(device1, device2, device3);
}
