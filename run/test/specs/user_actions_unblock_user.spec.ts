import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { BlockUser, BlockUserConfirmationModal } from './locators';
import { ConversationSettings } from './locators/conversation';
import { open_Alice1_Bob1_friends } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Unblock user',
  risk: 'low',
  testCb: unblockUser,
  countOfDevicesNeeded: 2,
});

async function unblockUser(platform: SupportedPlatformsType) {
  const {
    devices: { alice1, bob1 },
    prebuilt: { alice, bob },
  } = await open_Alice1_Bob1_friends({
    platform,
    focusFriendsConvo: true,
  });
  const blockedMessage = `Blocked message from ${bob.userName} to ${alice.userName}`;
  await alice1.clickOnElementAll(new ConversationSettings(alice1));
  await alice1.clickOnElementAll(new BlockUser(alice1));
  await alice1.checkModalStrings(
    englishStripped('block').toString(),
    englishStripped('blockDescription').withArgs({ name: bob.userName }).toString(),
    true
  );
  await alice1.clickOnElementAll(new BlockUserConfirmationModal(alice1));
  await alice1.onIOS().navigateBack();
  const blockedStatus = await alice1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });

  if (blockedStatus) {
    console.info(`${bob.userName} has been blocked`);
  } else {
    console.info('Blocked banner not found');
  }
  // Send message from Blocked User
  await bob1.sendMessage(blockedMessage);
  await alice1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Message body',
    text: blockedMessage,
    maxWait: 5000,
  });
  // Now that user is blocked, unblock them
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Blocked banner' });
  await alice1.checkModalStrings(
    englishStripped('blockUnblock').toString(),
    englishStripped('blockUnblockName').withArgs({ name: bob.userName }).toString(),
    true
  );
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Unblock' });
  await alice1.doesElementExist({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
    maxWait: 2000,
  });
}
