import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { BlockedContactsSettings, BlockUser, BlockUserConfirmationModal } from './locators';
import { UserSettings } from './locators/settings';
import { sleepFor } from './utils';
import { newUser } from './utils/create_account';
import { newContact } from './utils/create_contact';
import { linkedDevice } from './utils/link_device';
import { closeApp, openAppThreeDevices, SupportedPlatformsType } from './utils/open_app';

bothPlatformsIt('Block user in conversation options', 'high', blockUserInConversationOptions);

async function blockUserInConversationOptions(platform: SupportedPlatformsType) {
  //Open three devices and creates two contacts (Alice and Bob)
  // Alice has linked device (1 and 3)
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  const userA = await linkedDevice(device1, device3, USERNAME.ALICE);

  const userB = await newUser(device2, USERNAME.BOB);

  await newContact(platform, device1, userA, device2, userB);
  // Block contact
  // Click on three dots (settings)
  await device1.clickOnByAccessibilityID('More options');
  // Select Block option
  await sleepFor(500);
  await device1.clickOnElementAll(new BlockUser(device1));
  // Wait for menu to be clickable (Android)
  // Confirm block option
  await device1.clickOnElementAll(new BlockUserConfirmationModal(device1));
  // On ios there is an alert that confirms that the user has been blocked
  await sleepFor(1000);
  // On ios, you need to navigate back to conversation screen to confirm block
  await device1.onIOS().navigateBack();
  // Look for alert at top of screen (Bob is blocked. Unblock them?)
  // Check device 1 for blocked status
  const blockedStatus = await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Blocked banner',
  });
  if (blockedStatus) {
    // Check linked device for blocked status (if shown on device1)
    await device3.clickOnElementAll({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: `${userB.userName}`,
    });
    await device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Blocked banner',
    });
    console.info(`${userB.userName}` + ' has been blocked');
  } else {
    console.info('Blocked banner not found');
  }
  // Check settings for blocked user
  await device1.navigateBack();
  await device1.clickOnElementAll(new UserSettings(device1));
  await device1.clickOnElementAll({ strategy: 'accessibility id', selector: 'Conversations' });
  await device1.clickOnElementAll(new BlockedContactsSettings(device1));
  await device1.waitForTextElementToBePresent({
    strategy: 'accessibility id',
    selector: 'Contact',
    text: userB.userName,
  });

  // Close app
  await closeApp(device1, device2, device3);
}

// TODO unblock user
