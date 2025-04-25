import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { BlockUser, BlockUserConfirmationModal } from './locators';
import { ConversationSettings } from './locators/conversation';
import { open2AppsWithFriendsState } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Unblock user',
  risk: 'low',
  testCb: unblockUser,
  countOfDevicesNeeded: 2,
});

async function unblockUser(platform: SupportedPlatformsType) {
  const {
    devices: { device1, device2 },
    prebuilt: { userA, userB },
  } = await open2AppsWithFriendsState({
    platform,
    focusFriendsConvo: true,
  });
  const blockedMessage = `Blocked message from ${userB.userName} to ${userA.userName}`;
  await device1.clickOnElementAll(new ConversationSettings(device1));
  await device1.clickOnElementAll(new BlockUser(device1));
  await device1.checkModalStrings(
    englishStripped('block').toString(),
    englishStripped('blockDescription').withArgs({ name: userB.userName }).toString(),
    true
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
    englishStripped('blockUnblockName').withArgs({ name: userB.userName }).toString(),
    true
  );
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Unblock' });
  await device1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
    maxWait: 2000,
  });
}
