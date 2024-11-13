import { englishStripped } from '../../localizer/i18n/localizedString';
import { bothPlatformsIt } from '../../types/sessionIt';
import { USERNAME } from '../../types/testing';
import { newUser } from './utils/create_account';
import { linkedDevice } from './utils/link_device';
import { SupportedPlatformsType, closeApp, openAppThreeDevices } from './utils/open_app';

bothPlatformsIt("Accept message request", 'high', acceptRequest);

async function acceptRequest(platform: SupportedPlatformsType) {
  // Check 'accept' button
  // Open app
  const { device1, device2, device3 } = await openAppThreeDevices(platform);
  // Create two users
  const userA = await newUser(device1, USERNAME.ALICE, platform);
  const userB = await linkedDevice(device2, device3, USERNAME.BOB, platform);

  // Send message from Alice to Bob
  await device1.sendNewMessage(userB, `${userA.userName} to ${userB.userName}`);
  // Wait for banner to appear
  // Bob clicks on message request banner
  await device2.clickOnByAccessibilityID('Message requests banner');
  // Bob clicks on request conversation item
  await device2.clickOnByAccessibilityID('Message request');
  // Bob clicks accept button on device 2 (original device)
  await device2.clickOnByAccessibilityID('Accept message request');
  // Check control message for message request acceptance
  // "messageRequestsAccepted": "Your message request has been accepted.",
  const messageRequestsAccepted = englishStripped('messageRequestsAccepted').toString();
  const messageRequestYouHaveAccepted = englishStripped('messageRequestYouHaveAccepted')
    .withArgs({ name: userA.userName })
    .toString();
  await Promise.all([
    device1.waitForControlMessageToBePresent(messageRequestsAccepted),
    device2.waitForControlMessageToBePresent(messageRequestYouHaveAccepted),
  ]);
  // Check conversation list for new contact (user A)
  await device2.navigateBack();
  await Promise.all([
    device2.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userA.userName,
    }),
    device3.waitForTextElementToBePresent({
      strategy: 'accessibility id',
      selector: 'Conversation list item',
      text: userA.userName,
    }),
  ]);
  // Close app
  await closeApp(device1, device2, device3);
}
