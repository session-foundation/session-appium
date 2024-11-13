import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { DeleteContactModalConfirm } from './locators/global';
import { runOnlyOnAndroid, runOnlyOnIOS } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { openAppMultipleDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Delete contact', 'high', deleteContact);

async function deleteContact(platform: SupportedPlatformsType) {
  const [device1, device2, device3] = await openAppMultipleDevices(platform, 3);
  const [Alice, Bob] = await Promise.all([
    linkedDevice(device1, device3, USERNAME.ALICE, platform),
    newUser(device2, USERNAME.BOB, platform),
  ]);

  await newContact(platform, device1, Alice, device2, Bob);
  // Check contact has loaded on linked device
  await device1.navigateBack();
  await device2.navigateBack();
  // Check username has changed from session id on both device 1 and 3
  await Promise.all([
    device1.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
    }),
  ]);
  // Delete contact
  await runOnlyOnIOS(platform, () => device1.swipeLeft('Conversation list item', Bob.userName));
  await runOnlyOnAndroid(platform, () => device1.longPressConversation(Bob.userName));
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Delete' });
  // TODO Fix once args checks are merged
  // await device1.checkModalStrings('conversationsDelete', 'conversationsDeleteDescription');
  await device1.clickOnElementAll(new DeleteContactModalConfirm(device1));
  await Promise.all([
    device1.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
      maxWait: 500,
    }),
    device3.doesElementExist({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: Bob.userName,
      maxWait: 500,
    }),
  ]);
}
