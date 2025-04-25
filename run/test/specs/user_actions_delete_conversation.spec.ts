import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteContactModalConfirm } from './locators/global';
import { open3Apps2Friends2LinkedFirstUser } from './state_builder';
import { SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt({
  title: 'Delete conversation',
  risk: 'high',
  testCb: deleteConversation,
  countOfDevicesNeeded: 3,
});

async function deleteConversation(platform: SupportedPlatformsType) {
  const {
    devices: { device1: alice1, device2: alice2 },
    prebuilt: { userB },
  } = await open3Apps2Friends2LinkedFirstUser({ platform, focusFriendsConvo: false });

  // Check contact has loaded on linked device
  // await alice1.navigateBack();
  // await bob1.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all([
    alice1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
    }),
    alice2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
    }),
  ]);
  // Delete conversation
  await alice1.onIOS().swipeLeft('Conversation list item', userB.userName);
  await alice1.onAndroid().longPressConversation(userB.userName);
  await alice1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
  await alice1.checkModalStrings(
    englishStripped('conversationsDelete').toString(),
    englishStripped('conversationsDeleteDescription').withArgs({ name: USERNAME.BOB }).toString(),
    true
  );
  await alice1.clickOnElementAll(new DeleteContactModalConfirm(alice1));
  await Promise.all([
    alice1.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
      maxWait: 500,
    }),
    alice2.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
      maxWait: 500,
    }),
  ]);
}
