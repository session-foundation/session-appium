import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockUser, BlockUserConfirmationModal } from './locators';
import { ConversationSettings } from './locators/conversation';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { openAppTwoDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Unblock user', 'low', unblockUser);

async function unblockUser(platform: SupportedPlatformsType) {
  const { device1, device2 } = await openAppTwoDevices(platform);
  const [userA, userB] = await Promise.all([
    newUser(device1, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);
  const blockedMessage = `Blocked message from ${userB.userName} to ${userA.userName}`;
  await newContact(platform, device1, userA, device2, userB);
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new BlockUser(device1));
  await device1.checkModalStrings(
    englishStripped('block').toString(),
    englishStripped('blockDescription').withArgs({ name: userB.userName }).toString()
  );
  await device1.clickOnElementAll(new BlockUserConfirmationModal(device1));
  await device1.onIOS().navigateBack();
  const blockedStatus = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });

  if (blockedStatus) {
    console.info(`${userB.userName} has been blocked`);
  } else {
    console.info('Blocked banner not found');
  }
  // Send message from Blocked User
  await device2.sendMessage(blockedMessage);
  await device1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
    maxWait: 5000,
  });
  // Now that user is blocked, unblock them
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Blocked banner' });
  await device1.checkModalStrings(
    englishStripped('blockUnblock').toString(),
    englishStripped('blockUnblockName').withArgs({ name: userB.userName }).toString()
  );
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Unblock' });
  //   Blocked message should now be visible
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
  });
}
