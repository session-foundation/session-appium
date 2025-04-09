import { englishStripped } from '../../localizer/Localizer';
import { androidIt, iosIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteMessageConfirmationModal, DeleteMessageLocally } from './locators';
import { DeletedMessage } from './locators/conversation';
import { newUser } from './utils/create_account';
import { createGroup } from './utils/create_group';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

iosIt('Delete message in group', 'high', deleteMessageGroup);
androidIt('Delete message in group', 'high', deleteMessageGroup);

async function deleteMessageGroup(platform: SupportedPlatformsType) {
  const testGroupName = 'Message checks for groups';
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create users A, B and C
  const [userA, userB, userC] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
    newUser(device3, USERNAME.CHARLIE),
  ]);
  // Create contact between User A and User B
  await createGroup(platform, device1, userA, device2, userB, device3, userC, testGroupName);
  const sentMessage = await device1.sendMessage('Checking local delete functionality');
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
  await device1.clickOnElementAll(new DeleteMessageLocally(device1));
  await device1.clickOnElementAll(new DeleteMessageConfirmationModal(device1));
  await device1.waitForTextElementToBePresent(new DeletedMessage(device1));
  // Excellent
  // Check device 2 and 3 that message is still visible
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
  await closeApp(device1, device2, device3);
}
