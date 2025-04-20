import { englishStripped } from '../../localizer/Localizer';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteContactModalConfirm } from './locators/global';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Delete conversation', 'high', deleteConversation);

async function deleteConversation(platform: SupportedPlatformsType) {
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const [userA, userB] = await Promise.all([
    linkedDevice(device1, device3, USERNAME.ALICE),
    newUser(device2, USERNAME.BOB),
  ]);

  await newContact(platform, device1, userA, device2, userB);
  // Check contact has loaded on linked device
  await device1.navigateBack();
  await device2.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
    }),
  ]);
  // Delete conversation
  await device1.onIOS().swipeLeft('Conversation list item', userB.userName);
  await device1.onAndroid().longPressConversation(userB.userName);
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
  await device1.checkModalStrings(
    englishStripped('conversationsDelete').toString(),
    englishStripped('conversationsDeleteDescription').withArgs({ name: USERNAME.BOB }).toString(),
    true
  );
  await device1.clickOnElementAll(new DeleteContactModalConfirm(device1));
  await Promise.all([
    device1.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
      maxWait: 500,
    }),
    device3.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userB.userName,
      maxWait: 500,
    }),
  ]);
}
